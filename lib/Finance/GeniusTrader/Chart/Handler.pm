package Finance::GeniusTrader::Chart::Handler;
use base qw(Tatsumaki::Handler);

use Finance::GeniusTrader::Eval;
use Finance::GeniusTrader::Tools qw(:conf :timeframe);

my %calc;

sub _get_calc {
    my ($self, $code, $tf) = @_;
    my $timeframe = Finance::GeniusTrader::DateTime::name_to_timeframe($tf);
    $calc{$code}{$tf} ||= (find_calculator($main::db, $code, $timeframe, 1))[0];

}


1;
