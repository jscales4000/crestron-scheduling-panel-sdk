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
            settings = $rootScope.Helium.settings || {},
            room = settings.room || {},

            resolveCopy = function () {
                var lang = (room.language || 'en').toLowerCase().slice(0, 2);
                return HoldingMode.copy[lang] || HoldingMode.copy.en;
            },

            tick = function () {
                $scope.now = new Date();
            };

        var copy = resolveCopy();

        $scope.greeting = copy.greeting;
        $scope.phrases = copy.phrases;
        $scope.phraseIndex = 0;
        $scope.roomName = $rootScope.Helium.values ? $rootScope.Helium.values.roomName : '';
        $scope.isImpair = $rootScope.Helium.state.theme === 'impair-theme';

        // Date/time formats are normalised by SettingsService from the panel's
        // own 12/24h and date-order configuration.
        $scope.timeFormat = room.timeFormat || 'h:mm a';
        $scope.dateFormat = room.dateFormat || 'fullDate';

        // The holding screen IS the permanent view - the stock screensaver
        // would cover it. Burn-in is handled by CSS motion instead.
        AppStateService.stopScreensaverTimeout();

        // Shared minute-resolution ticker. Do not add another timer.
        tick();
        AppClockService.subscribe(tick);

        // Cross-fade the message slot. Suppressed under impair-theme, which
        // ships for low-vision users - motion works against that need.
        if (!$scope.isImpair && $scope.phrases.length > 1) {
            phraseTimer = $interval(function () {
                $scope.phraseIndex = ($scope.phraseIndex + 1) % $scope.phrases.length;
            }, HoldingMode.phraseIntervalMs);
        }

        $scope.$on('$destroy', function () {
            AppClockService.unsubscribe(tick);
            if (phraseTimer) {
                $interval.cancel(phraseTimer);
                phraseTimer = null;
            }
        });
    }
})();
