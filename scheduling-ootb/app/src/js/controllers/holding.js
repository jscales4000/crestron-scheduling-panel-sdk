/**
 * Holding screen controller
 *
 * Everything on this screen comes from the panel itself - room name, clock
 * format and theme all arrive on the 'config' channel. Nothing is hardcoded
 * except the site copy in HoldingMode.
 */
(function () {
    'use strict';

    angular
        .module('helium')
        .controller('HoldingCtrl', HoldingCtrl);

    HoldingCtrl.$inject = [
        '$rootScope',
        '$scope',
        '$interval',
        'HoldingMode',
        'AppClockService',
        'AppStateService'
    ];

    function HoldingCtrl($rootScope, $scope, $interval, HoldingMode, AppClockService, AppStateService) {
        var phraseTimer = null,

            resolveCopy = function () {
                var room = (($rootScope.Helium.settings || {}).room) || {},
                    lang = (room.language || 'en').toLowerCase().slice(0, 2);
                return HoldingMode.copy[lang] || HoldingMode.copy.en;
            },

            resolveLogo = function () {
                var state = $rootScope.Helium.state || {},
                    stacked = state.layout === 'vertical' || state.layout === 'portrait',
                    // White logo on every dark theme. impair-theme is a DARK
                    // theme (background $theme-color-2 = black, foreground
                    // $theme-color-9 = white), same as dark-theme - only
                    // light-theme needs the black lockup.
                    white = state.theme !== 'light-theme';

                return 'assets/images/brand/logo-' +
                    (stacked ? 'stacked' : 'horizontal') + '-' +
                    (white ? 'white' : 'black') + '.png';
            },

            stopPhraseTimer = function () {
                if (phraseTimer) {
                    $interval.cancel(phraseTimer);
                    phraseTimer = null;
                }
            },

            startPhraseTimer = function () {
                if (!phraseTimer && $scope.phrases.length > 1) {
                    phraseTimer = $interval(function () {
                        $scope.phraseIndex = ($scope.phraseIndex + 1) % $scope.phrases.length;
                    }, HoldingMode.phraseIntervalMs);
                }
            },

            tick = function () {
                $scope.now = new Date();
            };

        $scope.phrases = [];
        $scope.phraseIndex = 0;

        // Date/time formats are normalised by SettingsService from the panel's
        // own 12/24h and date-order configuration. Read live - Helium.settings
        // is REPLACED wholesale by SettingsService.overwriteSettings, so a
        // captured reference goes stale the moment config is re-pushed.
        $scope.timeFmt = function () {
            var r = (($rootScope.Helium.settings || {}).room) || {};
            return r.timeFormat || 'h:mm a';
        };

        $scope.dateFmt = function () {
            var r = (($rootScope.Helium.settings || {}).room) || {};
            return r.dateFormat || 'fullDate';
        };

        // The holding screen IS the permanent view - the stock screensaver
        // would cover it. Burn-in is handled by CSS motion instead.
        AppStateService.stopScreensaverTimeout();

        // Shared minute-resolution ticker. Do not add another timer.
        tick();
        AppClockService.subscribe(tick);

        // Theme and layout arrive with config and can change at runtime.
        // Re-derive the copy, the impair flag and the logo whenever they do -
        // a stale logo can render invisible against a changed background.
        $scope.$watchGroup(
            [
                function () { return $rootScope.Helium.state.theme; },
                function () { return $rootScope.Helium.state.layout; },
                function () { return (($rootScope.Helium.settings || {}).room || {}).language; }
            ],
            function () {
                var copy = resolveCopy();
                $scope.greeting = copy.greeting;
                $scope.phrases = copy.phrases;
                if ($scope.phraseIndex >= $scope.phrases.length) { $scope.phraseIndex = 0; }
                $scope.isImpair = $rootScope.Helium.state.theme === 'impair-theme';
                $scope.logoSrc = resolveLogo();

                // Cross-fade the message slot. Suppressed under impair-theme,
                // which ships for low-vision users - motion works against
                // that need. Start/stop rather than recreate, so a theme
                // flip never leaves two intervals running.
                if ($scope.isImpair) {
                    stopPhraseTimer();
                } else {
                    startPhraseTimer();
                }
            }
        );

        $scope.$on('$destroy', function () {
            AppClockService.unsubscribe(tick);
            stopPhraseTimer();
        });
    }
})();
