#!perl -T

use Test::More tests => 1;

BEGIN {
    use_ok( 'Finance::GeniusTrader::Chart' );
}

diag( "Testing Finance::GeniusTrader::Chart $Finance::GeniusTrader::Chart::VERSION, Perl $], $^X" );
