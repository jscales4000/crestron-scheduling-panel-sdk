/**
 * This software development kit (SDK) consisting of HTML and JavaScript sample code is licensed under the general terms of Crestron’s Software Development Tools
 * License Agreement, with the exception that you are granted permission to redistribute derivative works of the provided sample code in source code format.
 * This license is located at http://www.crestron.com/legal/software-license-agreement.  This SDK can be used to customize the user experience with Crestron scheduling panels.
 * If edited in a way that’s contrary to our instructions, this SDK could result in unexpected behavior and a diminished user experience.
 */

 
/**
 * Application run
 */

(function() {
  'use strict';

  angular.module('helium').run(runSources);

  runSources.$inject = [
    '$rootScope',
    'AppStateService',
    '$location',
    '$document',
    'ModalService',
    'ThemeService',
    'LayoutService',
    'HoldingMode'
  ];

  function runSources($rootScope, AppStateService, $location, $document, ModalService, ThemeService, LayoutService, HoldingMode) {
    var flagStart = false;

    AppStateService.listenForActions();
    AppStateService.createMethods();

    // In holding mode go straight to the holding screen. The stock splash waits
    // for BOTH config and providerStatus before anything advances it, so a panel
    // with no calendar provider configured would otherwise sit on the Crestron
    // logo forever - precisely the case this screen exists to cover.
    $location.path(HoldingMode.enabled ? '/page/' + HoldingMode.page : 'page/splash');

    // Configure UI
    ThemeService.loadTheme();
    LayoutService.loadLayout();

    // Set timeline block dimensions based on panel type
    AppStateService.setTimelineBlockDimensions();

    var touchEndHandler = function () {
      AppStateService.startScreensaverTimeout();

      $document[0].removeEventListener('touchend', touchEndHandler, { passive: false });
      $document[0].removeEventListener('touchcancel', touchEndHandler, { passive: false });
    };

    var touchStartHandler = function () {
      // Stop screensaver timeout until user is finished interacting
      AppStateService.stopScreensaverTimeout();
      $document[0].addEventListener('touchend', touchEndHandler, { passive: false });
      $document[0].addEventListener('touchcancel', touchEndHandler, { passive: false });
    };

    $rootScope.$on('$locationChangeStart', function() {
      flagStart = true;
      ModalService.closeAll();
      $rootScope.Helium.state.loading.state = false;
    });

    $rootScope.$on('$routeChangeSuccess', function() {
      if (!flagStart) {
        ModalService.closeAll();
      }
      flagStart = false;
    });

    $rootScope.$on('$routeChangeError', function(event, current, previous) {
      $rootScope.Helium.methods.openPage(previous.params.page);
    });

    // Listen for user interaction event to stop screensaver timeout
    $document[0].addEventListener('touchstart', touchStartHandler, { passive: true });

    $rootScope.$on('destroy', function() {
      $document[0].removeEventListener('touchstart', touchStartHandler, { passive: true });
      $document[0].removeEventListener('touchend', touchEndHandler, { passive: false });
      $document[0].removeEventListener('touchcancel', touchEndHandler, { passive: false });
    });
  }
})();
