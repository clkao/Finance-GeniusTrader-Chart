#!/usr/bin/perl
use strict;
use warnings;
use Tatsumaki;
use Tatsumaki::Error;
use Tatsumaki::Application;
use Tatsumaki::MessageQueue;
use Try::Tiny;
use JSON;

package MainHandler;
use base qw(Tatsumaki::Handler);

sub get {
    my $self = shift;
    $self->write("ohai");
}

package CodeHandler;
use base qw(Finance::GeniusTrader::Chart::Handler);

sub get {
    my ($self, $code, $tf) = @_;
    my $calc = $self->_get_calc($code, $tf)
        or Tatsumaki::Error::HTTP->throw(404);
    $self->render('default.html', { env => $self->request->env, code => $code, tf => $tf, calc => $calc } );
}

package PricesHandler;
use base qw(Finance::GeniusTrader::Chart::Handler);
use Finance::GeniusTrader::Prices;
use JSON;

sub post {
    my ($self, $code, $tf) = @_;
    my $v = $self->request->params;
    unless (defined $v->{start} && defined $v->{end}) {
        Tatsumaki::Error::HTTP->throw(404);
    }
    my $calc = $self->_get_calc($code, $tf)
        or Tatsumaki::Error::HTTP->throw(404);

    $self->response->content_type('application/json; charset=UTF-8');
    my $res = [ map { [ @$_[$DATE, $OPEN, $HIGH, $LOW, $CLOSE] ] }
                    map { $calc->prices->at($_) } ($v->{start}..$v->{end}) ];
    $self->write(to_json($res));
    $self->finish;
}

package ResolveDateHandler;
use base qw(Finance::GeniusTrader::Chart::Handler);
use JSON;

sub post {
    my ($self, $code, $tf) = @_;
    my $v = $self->request->params;
    my $d = $v->{date};
    $d = [ $d ? $d : () ] unless ref($d) eq 'ARRAY';

    my $calc = $self->_get_calc($code, $tf)
        or Tatsumaki::Error::HTTP->throw(404);

    $self->response->content_type('application/json; charset=UTF-8');
    my $res = [ map { $calc->prices->date($_) } @$d ];
    $self->write(to_json($res));
    $self->finish;
}

package PricesMultipartPollHandler;
use base qw(Finance::GeniusTrader::Chart::Handler);
__PACKAGE__->asynchronous(1);

sub get {
    my ($self, $code, $tf) = @_;
    my $calc = $self->_get_calc($code, $tf)
        or Tatsumaki::Error::HTTP->throw(404);

    my $channel = "$code/$tf";
    my $client_id = $self->request->param('client_id') || rand(1);
    $self->multipart_xhr_push(1);

    my $mq = Tatsumaki::MessageQueue->instance($channel);
    $mq->poll($client_id, sub {
        my @events = @_;
        for my $event (@events) {
            $self->stream_write($event);
        }
    });
}

package IndicatorHandler;
use base qw(Finance::GeniusTrader::Chart::Handler);
use Finance::GeniusTrader::Eval;

use JSON;

sub post {
    my ($self, $code, $tf) = @_;
    my $v = $self->request->params;
    unless (defined $v->{start} && defined $v->{end}) {
        Tatsumaki::Error::HTTP->throw(404);
    }
    my $calc = $self->_get_calc($code, $tf)
        or Tatsumaki::Error::HTTP->throw(404);


    my ($mod, $arg) = split(/ /, $v->{name}, 2);
    my $object = create_standard_object($mod, $arg) or die;;
    my $which = $mod =~ m#/(\d+)# ? $1 : 0;
    my $object_name = $object->get_name($which);

    $object->calculate_interval( $calc, $v->{start}, $v->{end} );

    $self->response->content_type('application/json; charset=UTF-8');
    my $res = [ map { $calc->indicators->get( $object_name, $_ ) }
                    ($v->{start}..$v->{end}) ];
    $self->write(to_json($res));
    $self->finish;
}

package main;
use File::Basename;
use Getopt::Long;
use Finance::GeniusTrader;
use Finance::GeniusTrader::CLI;

my $code_re = qr/\w+/;
my $tf_re = qr/\w+/;

my $app = Tatsumaki::Application->new([
    "/d/($code_re)/($tf_re)/prices" => 'PricesHandler',
    "/d/($code_re)/($tf_re)/indicator" => 'IndicatorHandler',
    "/d/($code_re)/($tf_re)/resolvedate" => 'ResolveDateHandler',
#    "/d/($code_re)/($tf_re)/poll" => 'PricesPollHandler',
    "/d/($code_re)/($tf_re)/mxhrpoll" => 'PricesMultipartPollHandler',
    "/d/($code_re)/($tf_re)" => 'CodeHandler',
    '/' => 'MainHandler',
]);

$app->template_path(dirname(__FILE__) . "/templates");
$app->static_path(dirname(__FILE__) . "/static");

if (try { require Plack::Middleware::JSConcat }) {
$app = Plack::Middleware::JSConcat->wrap
    ($app,
     filter => '/Users/clkao/bin/jsmin',
     files => [map { "static/$_"}
                   qw(jquery-1.3.2.min.js jquery.ev.js
                      joose.js raphael.js
                      plugins/raphael.path.methods.js
                      plugins/raphael.primitives.js
                      gtchart.js
                 )]);
}
require Plack::Middleware::ConditionalGET;
require Plack::Middleware::ContentLength;
require Plack::Middleware::Deflater;
$app = Plack::Middleware::ContentLength->wrap($app);
$app = Plack::Middleware::ConditionalGET->wrap($app);
# XXX: buggy for firefox
#$app = Plack::Middleware::Deflater->wrap($app);

use Finance::GeniusTrader::Calculator;
use Finance::GeniusTrader::Conf;
use Finance::GeniusTrader::Eval;
use Finance::GeniusTrader::Tools qw(:conf :timeframe);
Finance::GeniusTrader::Conf::load();
our $db = create_db_object();

return $app;


