use inc::Module::Install;

name     'Finance-GeniusTrader-Chart';
all_from 'lib/Finance/GeniusTrader/Chart.pm';
readme_from 'lib/Finance/GeniusTrader/Chart.pm';
author   q{Chia-liang Kao <clkao@clkao.org>};
license  'perl';

build_requires 'Test::More';

requires 'Try::Tiny';
requires 'Plack';
requires 'Plack::Middleware::JSConcat';
requires 'Tatsumaki';
requires 'Try::Tiny';
requires 'JSON';
requires 'Finance::GeniusTrader::CLI'; # XXX requires my branch

auto_include_deps;
author_tests('xt');
auto_set_repository;
WriteAll;
