/**
 * Holding screen controller
 */
(function () {
    'use strict';

    angular
        .module('helium')
        .controller('HoldingCtrl', HoldingCtrl);

    HoldingCtrl.$inject = ['$scope', 'HoldingMode'];

    function HoldingCtrl($scope, HoldingMode) {
        $scope.greeting = HoldingMode.copy.en.greeting;
    }
})();
