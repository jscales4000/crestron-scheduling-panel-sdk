/**
 * This software development kit (SDK) consisting of HTML and JavaScript sample code is licensed under the general terms of Crestron’s Software Development Tools
 * License Agreement, with the exception that you are granted permission to redistribute derivative works of the provided sample code in source code format.
 * This license is located at http://www.crestron.com/legal/software-license-agreement.  This SDK can be used to customize the user experience with Crestron scheduling panels.
 * If edited in a way that’s contrary to our instructions, this SDK could result in unexpected behavior and a diminished user experience.
 */

(function () {
  'use strict';

  angular.module('helium')
    .service('AppStateService', AppStateService);

  AppStateService.$inject = [
    '$rootScope',
    '$location',
    '$uibModal',
    'templateService',
    'UtilFactory',
    'LocalizationService',
    'TimelineService',
    '$timeout',
    'CommunicationService',
    'AppConfig',
    'SettingsService',
    'DatetimeFactory',
    'ThemeService',
    'BackgroundService',
    'AppClockService',
  ];

  function AppStateService(
    $rootScope,
    $location,
    $uibModal,
    templateService,
    UtilFactory,
    LocalizationService,
    TimelineService,
    $timeout,
    CommunicationService,
    AppConfig,
    SettingsService,
    DatetimeFactory,
    ThemeService,
    BackgroundService,
    AppClockService)
  {
    var me = this;
    var timeoutShowScreenSaver;
    var initInfo = {
      config: false,
      providerStatus: false,
    };
    var readyStart = false;

    $rootScope.Helium = {
      methods: {},
      language: {},
      settings: {
        countDownScreenSaver: AppConfig.screenSaverDelay,
        schedule: {
          source: '',
        },
        room: {
          enableAvailableOccupiedState: true,
        },
      },
      settingsExtra: {
        supportsInstanceManipulation: false,
        readOnlyModeEnabled: false,
      },
      labels: {},
      values: {
        mainRoom: { events: [], currentEvent: null, nextEvent: null },
      },
      state: {
        layout: '',
        portraitPanel: false,
        countOpenModals: 0,
        modalOpen: false,
        help: false,
        loading: {
          state: false,
          message: 'Loading',
        },
        isOnline: true,
        roomOccupied: false,
        isArabic: false,
        buttons: {
          disable: {},
        },
        needPin: false,
        checkInEvent: null,
        openAbout: false,
        refreshingProvider: false,
        timelineBlockHorizontalSize: 322,
        timelineBlockVerticalSize: 113,
      },
    };

    $rootScope.pendingReservation = {
      prevRoomID: 0
    };

    function setButtonsStatus() {
      var disable = $rootScope.Helium.state.buttons.disable;
      var isOnline = $rootScope.Helium.state.isOnline;

      $rootScope.Helium.state.setVisibleEndNow();
      $rootScope.Helium.state.setVisibleExtendNow();
      $rootScope.Helium.state.setVisibleCheckInNow();

      $rootScope.Helium.state.setDisableEndNow();
      $rootScope.Helium.state.setDisableExtendNow();
      $rootScope.Helium.state.setDisableCheckIn();

      disable.findRoom = !isOnline;
      disable.reserveNow = !isOnline;
    }

    function setRoomState() {
      setButtonsStatus();
      $rootScope.Helium.state.setRoomReserved();
    }

    // Update the state of the room and the buttons every minute
    AppClockService.subscribe(function () {
      console.log('AppStateService: Clock update');

      // Refresh state every minute
      setRoomState();
    });

    $rootScope.$watch('Helium.values.mainRoom.currentEvent', setRoomState);
    $rootScope.$watch('Helium.values.mainRoom.currentEvent.privacyLevel', setRoomState);
    $rootScope.$watch('Helium.values.mainRoom.nextEvent', setRoomState);
    $rootScope.$watch('Helium.values.mainRoom.currentEvent.checkedIn', setButtonsStatus);
    $rootScope.$watch('Helium.values.mainRoom.nextEvent.checkedIn', setRoomState);
    $rootScope.$watch('Helium.state.isOnline', setButtonsStatus);
    $rootScope.$watch('Helium.values.mainRoom.currentEvent.dtEnd', setButtonsStatus);
    $rootScope.$watch('Helium.values.mainRoom.nextEvent.dtStart', setRoomState);

    this.setTimelineBlockDimensions = function () {
      var screenWidth = window.screen ? window.screen.width : 0;
      var screenHeight = window.screen ? window.screen.height : 0;
      var isPortrait = screenHeight >= screenWidth;
      var blockWidth = 322;
      var blockHeight = 113;

      //Set portrait mode
      $rootScope.Helium.state.portraitPanel = isPortrait;

      //TSW-1060 = 1280x800
      //TSW-760  = 1261x739
      //TSW-560  = 640x363
      //TSW-570  = 640x360
      //TSW-770  = 1280x800
      //TSW-1070 = 1440x846??
      //Determine panel type by size and orientation
      if (isPortrait) {
        // console.log('AppStateService: setTimelineBlockDimensions: Panel is portrait');
        switch (screenHeight) {
          case 1280:
            blockWidth = 322;
            blockHeight = 113;
            break;
          case 640:
            blockWidth = 160;
            blockHeight = 70;
            break;
        }
      } else {
        switch (screenHeight) {
          case 800:
            blockWidth = 322;
            blockHeight = 113;
            break;
          case 739:
            blockWidth = 322;
            blockHeight = 113;
            break;
          case 363:
            blockWidth = 160;
            blockHeight = 68;
            break;
          case 360:
            blockWidth = 160;
            blockHeight = 68;
            break;
        }
      }

      $rootScope.Helium.state.timelineBlockHorizontalSize = blockWidth;
      $rootScope.Helium.state.timelineBlockVerticalSize = blockHeight;
    };

    this.listenForActions = function () {
      var doneInit = function () {
        if (initInfo.config && initInfo.providerStatus) {
          $timeout(function () {
            readyStart = true;
            $rootScope.Helium.methods.openPage('room');
            if ($rootScope.Helium.settings.display.disableIdleScreen) {
              console.log('AppStateService: Received action: Idle screen disabled. Stop timeout operation');
              me.stopScreensaverTimeout();
            } else {
              console.log('AppStateService: Received action: Idle screen enabled. Start timeout operation');
              me.startScreensaverTimeout();
            }
          }, 2000);
        }
      };

      CommunicationService.listenForProviderStatus(function (resp) {
        initInfo.providerStatus = true;
        $rootScope.$evalAsync(function () {
          $rootScope.Helium.state.vision = false;
          SettingsService.applyProviderState(resp);
          doneInit();
          BackgroundService.applyBackground();
        });
      });

      CommunicationService.listenForTimeline(function (resp) {
        $rootScope.$evalAsync(function () {
          TimelineService.applyRoomTimeline(resp.data);
        });
      });

      CommunicationService.listenForEvents(function (resp) {
        $rootScope.$evalAsync(function () {
          TimelineService.applyRoomEvents(resp.data);
        });
      });



      CommunicationService.listenForConfig(function (resp) {
        $rootScope.$evalAsync(function () {
          console.log('AppStateService: Received config: display.disableIdleScreen: ' + resp.data.settings.display.disableIdleScreen);
          $rootScope.Helium.state.vision = false;
          initInfo.config = true;
          LocalizationService.changeLanguage(resp.data.settings.room, function () {
            SettingsService.applySettings(resp.data);
            setRoomState();
            SettingsService.setNeedsPin(resp.data);
            if (SettingsService.isFirstInitialization()) {
              if (resp.data.settings.display.disableIdleScreen) {
                console.log('AppStateService: Received config: Idle screen disabled. Stop timeout operation');
                me.stopScreensaverTimeout();
              } else {
                console.log('AppStateService: Received config: Idle screen enabled. Start timeout operation');
                me.startScreensaverTimeout();
              }
            }
            doneInit();
            BackgroundService.applyBackground();
          });
          TimelineService.refreshStateOnCurrentMeeting();
        });
      });
    };

    this.createMethods = function () {
      $rootScope.Helium.methods.openPage = function (page) {
        if (readyStart) $location.path('/page/' + page);
      };

      var working = false;
      $rootScope.Helium.methods.openModal = function (modal, resolve, customOptions) {
        console.log('AppState: openModal called: ' + modal);
        if (working) {
          console.log('AppState: openModal: ' + modal + '. Already working on previous request. Return');
          return;
        }
        var controllerName = UtilFactory.getControllerModal(modal);
        var templateUrl = templateService.getModalTemplateUrl(modal);
        var mainDiv = $('main');
        var instance;

        $rootScope.Helium.methods.closeMenu();

        if (UtilFactory.existClass(controllerName) && templateUrl) {
          //Don't allow multiple quick presses to trigger multiple modal instances
          working = true;
          setTimeout(function () {
            working = false;
          }, 250);

          instance = $uibModal.open(
            angular.extend(
              {
                animation: true,
                backdrop: 'static',
                keyboard: false,
                templateUrl: templateUrl,
                controller: controllerName,
                windowClass: 'modal-' + modal,
                resolve: resolve || {},
              },
              customOptions
            )
          );

          instance.opened.then(function () {
            $rootScope.Helium.state.countOpenModals++;
            mainDiv.addClass('blur');
            $rootScope.Helium.state.modalOpen = true;
          });
          instance.closed.then(function () {
            $rootScope.Helium.state.countOpenModals--;
            if ($rootScope.Helium.state.countOpenModals < 1) {
              mainDiv.removeClass('blur');
              $rootScope.Helium.state.modalOpen = false;

              //Make sure the count doesn't go below 0 for some reason
              if ($rootScope.Helium.state.countOpenModals < 0) $rootScope.Helium.state.countOpenModals = 0;
            }
          });
        }
        return instance;
      };

      $rootScope.Helium.methods.openEndEvent = function () {
        console.log('AppState: openEndEvent called;');
        var callbackFn = function () {
          $rootScope.Helium.methods.openModal(
            'end-event'
          ).result.catch(function (resp) {
            if (['cancel', 'backdrop click', 'escape key press'].indexOf(resp) === -1) throw resp;
          });
        };

        if ($rootScope.Helium.state.needPin) {
          var modal = $rootScope.Helium.methods.openPin();

          if (modal) {
            modal.result.then(function () {
              callbackFn();
            });
          }
        } else {
          callbackFn();
        }
      };

      $rootScope.Helium.methods.openExtendEvent = function () {
        console.log('AppState: openExtendEvent called;');
        var callbackFn = function () {
          if ($rootScope.Helium.values.mainRoom.currentEvent.state.maxExtend) {
            $rootScope.Helium.methods.openModal(
              'extend-event'
            ).result.catch(function (resp) {
              if (['cancel', 'backdrop click', 'escape key press'].indexOf(resp) === -1) throw resp;
            });
          }
        };

        if ($rootScope.Helium.state.needPin) {
          var modal = $rootScope.Helium.methods.openPin();
          if (modal) {
            modal.result.then(function () {
              callbackFn();
            });
          }
        } else {
          callbackFn();
        }
      };

      $rootScope.Helium.methods.closeHelp = function () {
        console.log('AppState: closeHelp called;');
        // document.removeEventListener('touchend', closeHelp);
        $rootScope.$evalAsync(function () {
          $rootScope.Helium.state.help = false;
        });
      };

      $rootScope.Helium.methods.openHelp = function () {
        console.log('AppState: openHelp called;');
        var closeHelp = function () {
          document.removeEventListener('touchend', closeHelp);
          $rootScope.$evalAsync(function () {
            $rootScope.Helium.state.help = false;
          });
        };

        $rootScope.Helium.methods.closeMenu();

        $rootScope.$evalAsync(function () {
          $rootScope.Helium.state.help = true;
        });

        setTimeout(function () {
          // TODO: Probably need to remove this listener in the $rootScope.Helium.methods.closeHelp function too
          document.addEventListener('touchend', $rootScope.Helium.methods.closeHelp);
        }, 10);
      };

      $rootScope.Helium.methods.openReservation = function (setNow, room) {
        //This is sent when a timeline block is pressed. It will be the time associated with the position pressed
        // console.log('appState: openReservation: setNow:');
        // console.log(setNow);

        //If room is not null, this is the result of a find rooms operation
        // console.log('appState: openReservation: room:');
        // console.log(room);

        var roomSettings = $rootScope.Helium.settings.room;
        var mainRoom = $rootScope.Helium.values.mainRoom;

        if (
          setNow &&
          $rootScope.Helium.state.isReserved() &&
          roomSettings &&
          roomSettings.availabilityThresholdRoomState &&
          DatetimeFactory.isDateBeforeDate(setNow, mainRoom.currentEvent.dtStart) &&
          DatetimeFactory.getTotalMinutesBetweenDates(setNow, mainRoom.currentEvent.dtStart) <= roomSettings.availabilityThresholdMin
        ) {
          console.log('AppState: Cannot create new reservation at the selected time. Within Availability Threshold of next meeting');
          return false;
        }

        var callbackFn = function () {
          var customOptions = room ? { windowClass: 'modal-reservation slide-right', animation: false } : {};

          if ($rootScope.Helium.state.isOnline) {
            var instanceReservation = $rootScope.Helium.methods.openModal(
              'reservation',
              {
                setNow: function () { return setNow; },
                room: function () { return room; },
              },
              customOptions
            );

            instanceReservation.result.catch(function (resp) {
              if (['cancel', 'backdrop click', 'escape key press', 'undefined'].indexOf(resp) === -1) throw resp;
            });

            if (room) {
              instanceReservation.rendered.then(function () {
                var modalReservation = $('.modal-reservation.slide-right');
                modalReservation.addClass('modal-show');
              });
            }
          }
        };

        if (!room && $rootScope.Helium.state.needPin) {
          var modal = $rootScope.Helium.methods.openPin();

          if (modal) {
            modal.result.then(function () {
              callbackFn();
            });
          }
        } else {
          callbackFn();
        }
      };

      $rootScope.Helium.methods.openFindRoom = function () {
        var callbackFn = function () {
          $rootScope.Helium.methods.openModal(
            'find-room'
          ).result.catch(function (resp) {
            if (['cancel', 'backdrop click', 'escape key press'].indexOf(resp) === -1) throw resp;
          });
        };

        if ($rootScope.Helium.state.needPin) {
          var modal = $rootScope.Helium.methods.openPin();

          if (modal) {
            modal.result.then(function () {
              callbackFn();
            });
          }
        } else {
          callbackFn();
        }
      };

      $rootScope.Helium.methods.openAbout = function () {
        $rootScope.Helium.methods.closeHelp();
        $rootScope.Helium.methods.closeMenu();
        var instance = $rootScope.Helium.methods.openModal(
          'about'
        );

        instance.opened.then(function () {
          $rootScope.Helium.state.openAbout = true;
        });
        instance.closed.then(function () {
          $rootScope.Helium.state.openAbout = false;
        });

        instance.result.catch(function (resp) {
          if (['cancel', 'backdrop click', 'escape key press'].indexOf(resp) === -1) throw resp;
        });
      };

      $rootScope.Helium.methods.openMsgError = function (addEvent) {
        $rootScope.Helium.methods.openModal('error-msg', {
          addEvent: function () {
            return addEvent;
          },
        }).result.catch(function (resp) {
          if (['cancel', 'backdrop click', 'escape key press'].indexOf(resp) === -1) throw resp;
        });
      };

      $rootScope.Helium.methods.openMsgSuccess = function (addEvent) {
        $rootScope.Helium.methods.openModal('success-msg', {
          addEvent: function () {
            return addEvent;
          },
        }).result.catch(function (resp) {
          if (['cancel', 'backdrop click', 'escape key press'].indexOf(resp) === -1) throw resp;
        });
      };

      $rootScope.Helium.methods.openPin = function () {
        if (!$rootScope.Helium.state.isOnline) {
          return false;
        }

        return $rootScope.Helium.methods.openModal('pin', null, {
          backdropClass: 'modalOpacity',
          backdrop: 'true',
        });
      };

      this.startScreensaverTimeout = function () {
        $timeout.cancel(timeoutShowScreenSaver);

        // Do not start timeout operation if Idle screen is disabled in configuration
        if ($rootScope.Helium.settings.display && $rootScope.Helium.settings.display.disableIdleScreen) {
          console.log('AppStateService: Idle screen disabled. Do not start timeout operation');
          return;
        }

        timeoutShowScreenSaver = $timeout(function () {
          $rootScope.Helium.state.vision = false;
          ThemeService.loadTheme();
          $rootScope.Helium.methods.openPage('screensaver');
        }, $rootScope.Helium.settings.countDownScreenSaver);
      };

      this.stopScreensaverTimeout = function () {
        $timeout.cancel(timeoutShowScreenSaver);
      };

      // Keeps the "Refresh" button in the animated, unpressable state for 30 seconds after a refresh
      this.setRefreshProviderTimeout = function () {
        $rootScope.Helium.state.refreshingProvider = true;
        setTimeout(function () {
          $rootScope.Helium.state.refreshingProvider = false;
        }, 30000);
      };

      $rootScope.Helium.methods.openMenu = function () {
        var menu = $('.menu__open');
        var menuOverlay = $('.menu__overlay');

        if (menu.length && menu.is(':checked')) {
          $rootScope.Helium.methods.setMenu(false);
          if (menuOverlay.length) {
            menuOverlay.addClass('menu__overlay--display');
          }
        } else {
          $rootScope.Helium.methods.setMenu(true);
          menuOverlay.removeClass('menu__overlay--display');
        }
      };

      $rootScope.Helium.methods.closeMenu = function () {
        var menu = $('.menu__open');
        var menuOverlay = $('.menu__overlay');

        if (menu.length && menu.is(':checked')) {
          menu.prop('checked', false);
          if (menuOverlay.length) {
            menuOverlay.removeClass('menu__overlay--display');
          }
        }
        $rootScope.Helium.methods.setMenu(true);
      };

      function setMenuButtonBgColor(hide) {
        var openButton = $('.menu__open__button');

        if (hide) {
          openButton.removeClass('bg__main-color-8');
        } else {
          openButton.addClass('bg__main-color-8');
        }
      }

      $rootScope.Helium.methods.setMenu = function (hide) {
        setMenuButtonBgColor(hide);
        setTimeout(function () {
          $rootScope.Helium.methods.setMenuItemVisibility(hide);
        }, 180);
      };

      $rootScope.Helium.methods.setMenuItemVisibility = function (hide) {
        var openButton = $('.menu__open__button');
        var close = $('.menu-close-label');
        var menuItem = $('.menu__item');

        if (hide) {
          menuItem
            .delay(1)
            .animate({ visibility: 'hidden' }, 0, function () {
              if (close.is(':visible')) {
                window.requestAnimationFrame(function () {
                  menuItem.css('visibility', 'visible');
                  openButton.css('border', '0');
                });
              } else {
                menuItem.css('visibility', 'hidden');
                window.requestAnimationFrame(function () {
                  openButton[0].setAttribute('style', '');
                  if ($rootScope.Helium.state.layout === 'vertical' || $rootScope.Helium.state.layout === 'portrait') {
                    openButton[0].setAttribute('style', 'background: transparent');
                  }
                });
              }
            });
        } else {
          if ($rootScope.Helium.state.layout === 'vertical' || $rootScope.Helium.state.layout === 'portrait') {
            window.requestAnimationFrame(function () {
              menuItem.css('visibility', 'visible');
              openButton[0].setAttribute('style', '');
              openButton.css('border', '0');
            });
          }
        }
      };

      $rootScope.Helium.state.isReserved = function () {
        return TimelineService.isReserved();
      };

      $rootScope.Helium.state.isAvailable = function () {
        return TimelineService.isAvailable();
      };

      $rootScope.Helium.state.isAvailableForTheRestOfTheDay = function () {
        return TimelineService.isAvailableForTheRestOfTheDay();
      };

      $rootScope.Helium.state.isOccupied = function () {
        return $rootScope.Helium.state.roomOccupied;
      };

      /**
       * Returns a formatted, localized string representing the remaining time
       * @param {object} event - The event for which the remaining time will be formatted
       * @returns {string} Formatted string 'x hours and x minutes', localized for current locale
       *
       */
      $rootScope.Helium.state.getRemainingTimeString = function (event) {
        var now = new Date();
        var endsIn = DatetimeFactory.getTimeLeftBetweenDates(now, event.dtEnd);
        var result = '';

        if (endsIn && endsIn.hours > 0) {
          result += endsIn.hours + ' ';
          result += endsIn.hours > 1 ? $rootScope.Helium.labels.hours : $rootScope.Helium.labels.hour;
          result += ' ' + $rootScope.Helium.labels.and + ' ';
        }
        result += endsIn.minutes + 1 + ' ';
        result += endsIn.minutes > 1 ? $rootScope.Helium.labels.minutes : $rootScope.Helium.labels.minute;

        return result;
      };

      $rootScope.Helium.state.setVisibleEndNow = function () {
        if ($rootScope.Helium.settingsExtra.readOnlyModeEnabled) {
          return false;
        }

        var endEarlyType = $rootScope.Helium.settings.reservation && $rootScope.Helium.settings.reservation.endEarlyType;
        var currentEvent = $rootScope.Helium.values.mainRoom ? $rootScope.Helium.values.mainRoom.currentEvent : null;

        if (currentEvent === null) return false;

        if (currentEvent && !$rootScope.Helium.settingsExtra.supportsInstanceManipulation && currentEvent.isRecurring) {
          // todo: Set visible state to false for recurring meetings? The button is disabled in the setDisabled function
          return false;
        }

        //Check if the reserved state is due to Availability Threshold mode or Reserved State for Check-in
        if (($rootScope.Helium.settings.room && $rootScope.Helium.settings.room.availabilityThresholdRoomState) ||
          ($rootScope.Helium.settings.display && $rootScope.Helium.settings.display.reservedColorForCheckedIn)) {

          var nextEvent = $rootScope.Helium.values.mainRoom ? $rootScope.Helium.values.mainRoom.nextEvent : null;

          if (nextEvent && currentEvent && nextEvent.id === currentEvent.id) {
            currentEvent.state.visibleEndNow = false;
            return false;
          }
        }

        // 141580 Add check for endEarlyType !== undefined or null
        if ($rootScope.Helium.state.isReserved() && (endEarlyType && endEarlyType.toLowerCase() !== 'off')) {
          var now = new Date();
          var totalMinEvent = DatetimeFactory.getTotalMinutesBetweenDates(currentEvent.dtStart, currentEvent.dtEnd);
          var totalMinPassedEvent = now > currentEvent.dtStart ? DatetimeFactory.getTotalMinutesBetweenDates(currentEvent.dtStart, now) : 0;

          if (endEarlyType.toLowerCase() === 'minutes') {
            var minutes = $rootScope.Helium.settings.reservation.freeUpRoomEnMin;

            if (angular.isNumber(minutes) && totalMinPassedEvent >= minutes) {
              currentEvent.state.visibleEndNow = true;
              return true;
            }
          } else if (endEarlyType.toLowerCase() === 'percentage') {
            var percentage = $rootScope.Helium.settings.reservation.freeUpRoomEnPer;
            var percentageMinEvent;

            if (angular.isNumber(percentage)) {
              // 141890 - Incorrect order of operations not returning correct percentage
              percentageMinEvent = percentage / 100 * totalMinEvent;
            }

            if (angular.isNumber(percentageMinEvent) && totalMinPassedEvent >= percentageMinEvent) {
              currentEvent.state.visibleEndNow = true;
              return true;
            }
          }
        }

        currentEvent.state.visibleEndNow = false;
        return false;
      };

      $rootScope.Helium.state.setDisableEndNow = function () {
        var disableButtons = $rootScope.Helium.state.buttons.disable;
        var isOnline = $rootScope.Helium.state.isOnline;
        var disable = false;

        if (
          $rootScope.Helium.values.mainRoom.currentEvent &&
          !$rootScope.Helium.settingsExtra.supportsInstanceManipulation &&
          $rootScope.Helium.values.mainRoom.currentEvent.isRecurring
        ) {
          disable = true;
        }

        var ret = isOnline ? disable : !isOnline;
        disableButtons.end = ret;
        return ret;
      };

      $rootScope.Helium.state.setVisibleExtendNow = function () {
        if ($rootScope.Helium.settingsExtra.readOnlyModeEnabled) {
          return false;
        }

        var reservation = $rootScope.Helium.settings.reservation;
        var extendReservationType = reservation && reservation.extendReservationType;
        var currentEvent = $rootScope.Helium.values.mainRoom ? $rootScope.Helium.values.mainRoom.currentEvent : null;

        if (currentEvent === null) return false;

        if (currentEvent && !$rootScope.Helium.settingsExtra.supportsInstanceManipulation && currentEvent.isRecurring) {
          // todo: Set visible state to false for recurring meetings? The button is disabled in the setDisabled function
          return false;
        }

        //Check if reserved state is due to Availability Threshold mode or Reserved State for Check-in
        if (($rootScope.Helium.settings.room && $rootScope.Helium.settings.room.availabilityThresholdRoomState) ||
          ($rootScope.Helium.settings.display && $rootScope.Helium.settings.display.reservedColorForCheckedIn)) {

          var nextEvent = $rootScope.Helium.values.mainRoom ? $rootScope.Helium.values.mainRoom.nextEvent : null;

          if (nextEvent && currentEvent && nextEvent.id === currentEvent.id) {
            currentEvent.state.visibleExtendNow = false;
            return false;
          }
        }

        // 141580 Add check for extendReservationType !== undefined or null
        if ($rootScope.Helium.state.isReserved() && (extendReservationType && extendReservationType.toLowerCase() !== 'off')) {
          var now = new Date();
          var totalMinEvent = DatetimeFactory.getTotalMinutesBetweenDates(currentEvent.dtEnd, currentEvent.dtStart);
          var totalMinPassedEvent = now > currentEvent.dtStart ? Math.round(DatetimeFactory.getTotalMinutesBetweenDates(currentEvent.dtStart, now)) : 0;
          var totalMinutesRemaining = totalMinEvent - totalMinPassedEvent;
          var minutes;

          var setExtendNowVisibility = function (mins) {
            if (totalMinutesRemaining <= 0) {
              currentEvent.state.visibleExtendNow = false;
              return false;
            }

            if (mins >= totalMinutesRemaining) {
              currentEvent.state.visibleExtendNow = true;
              return true;
            }

            currentEvent.state.visibleExtendNow = false;
            return false;
          };

          if (extendReservationType.toLowerCase() === 'minutes') {
            minutes = angular.isNumber(reservation.extendReservationMinAfter) ? reservation.extendReservationMinAfter : 0;

            return setExtendNowVisibility(minutes);
          } else if (extendReservationType.toLowerCase() === 'percentage') {
            var percentage = angular.isNumber(reservation.extendReservationPerAfter) ? reservation.extendReservationPerAfter : 0;

            // 141890 - Incorrect order of operations not returning correct percentage
            minutes = Math.max(1, Math.round(percentage / 100 * totalMinEvent));
            return setExtendNowVisibility(minutes);
          }
        }

        currentEvent.state.visibleExtendNow = false;
        return false;
      };

      $rootScope.Helium.state.setDisableExtendNow = function () {
        var disableButtons = $rootScope.Helium.state.buttons.disable;
        var isOnline = $rootScope.Helium.state.isOnline;
        var disable = false;
        var currentEvent = $rootScope.Helium.values.mainRoom.currentEvent;
        var nextEvent = $rootScope.Helium.values.mainRoom.nextEvent;
        var getTotalMinutesBetweenDates = nextEvent && currentEvent ? DatetimeFactory.getTotalMinutesBetweenDates(currentEvent.dtEnd, nextEvent.dtStart) : -1;

        if (
          (currentEvent && !$rootScope.Helium.settingsExtra.supportsInstanceManipulation && currentEvent.isRecurring) ||
          (nextEvent && currentEvent && getTotalMinutesBetweenDates === 0)
        ) {
          disable = true;
        }

        disableButtons.extend = isOnline ? disable : !isOnline;

        return disableButtons.extend;
      };

      function setVisibleCheckInNextEvent() {
        var nextEvent = $rootScope.Helium.values.mainRoom.nextEvent;
        var now;
        var totalMinLeftUntilNextEvent;
        var forceOrgCheckInMin = $rootScope.Helium.settings.automation && $rootScope.Helium.settings.automation.forceOrgCheckInMin;

        if (nextEvent) {
          now = new Date();
          totalMinLeftUntilNextEvent = DatetimeFactory.getTotalMinutesBetweenDates(now, nextEvent.dtStart);

          // Changed comparison operator to time til next meeting <= forceOrgCheckInMin
          // If forceOrgCheckInMin = 10, we want the check in button to appear when the next meeting starts in 10 minutes, not 9
          if (forceOrgCheckInMin && angular.isNumber(forceOrgCheckInMin) && totalMinLeftUntilNextEvent <= forceOrgCheckInMin) {
            nextEvent.state.visibleCheckInNow = true;
            $rootScope.Helium.state.checkInEvent = nextEvent;

            return true;
          } else {
            // console.log('D4NS_Debug: AppState: SetVisibleCheckInNext: Found next event, but not within threshold for check in');
            nextEvent.state.visibleCheckInNow = false;
            $rootScope.Helium.state.checkInEvent = null;

            return false;
          }
        }

        // console.log('D4NS_Debug: AppState: SetVisibleCheckInNext: Next event not found');
        $rootScope.Helium.state.checkInEvent = null;
        return false;
      }

      $rootScope.Helium.state.setVisibleCheckInNow = function () {
        if ($rootScope.Helium.settings.automation && $rootScope.Helium.settings.automation.forceOrgCheckIn) {
          if ($rootScope.Helium.state.isReserved()) {
            var event = $rootScope.Helium.values.mainRoom.currentEvent;
            var now = new Date();
            var totalMinPassedEvent = now > event.dtStart ? DatetimeFactory.getTotalMinutesBetweenDates(event.dtStart, now) : -1;
            var forceOrgCheckInEndMin = $rootScope.Helium.settings.automation.forceOrgCheckInEndMin;

            if (forceOrgCheckInEndMin && angular.isNumber(forceOrgCheckInEndMin)) {
              if (totalMinPassedEvent >= 0 && totalMinPassedEvent < forceOrgCheckInEndMin) {
                event.state.visibleCheckInNow = true;
                $rootScope.Helium.state.checkInEvent = event;
                return true;
              } else if (setVisibleCheckInNextEvent()) {
                event.state.visibleCheckInNow = false;
                return true;
              }
            } else if (setVisibleCheckInNextEvent()) {
              event.state.visibleCheckInNow = false;
              return true;
            }

            event.state.visibleCheckInNow = false;
            $rootScope.Helium.state.checkInEvent = null;
            return false;
          } else if ($rootScope.Helium.state.isAvailable()) {
            // console.log('D4NS_Debug: AppState: SetVisibleCheckIn: Room is available');
            return setVisibleCheckInNextEvent();
          }
        } else {
          $rootScope.Helium.state.checkInEvent = null;
          return false;
        }
      };

      $rootScope.Helium.state.setDisableCheckIn = function () {
        var disableButtons = $rootScope.Helium.state.buttons.disable;
        var isOnline = $rootScope.Helium.state.isOnline;
        var mainRoom = $rootScope.Helium.values.mainRoom;
        var disable = false;

        if (mainRoom.currentEvent && mainRoom.currentEvent.state.visibleCheckInNow) {
          disable = mainRoom.currentEvent.checkedIn;
        } else if (mainRoom.nextEvent && mainRoom.nextEvent.state.visibleCheckInNow) {
          disable = mainRoom.nextEvent.checkedIn;
        }

        var disableBtn = isOnline ? disable : true;
        disableButtons.checkIn = disableBtn;

        return disableButtons.checkIn;
      };

      //This function should really be called forceReservedState()
      //It is checking for conditions like Availability Threshold and Next Meeting Check In
      //If enabled, the conditions will set the UI to the Reserved state, before the meeting actually begins
      $rootScope.Helium.state.setRoomReserved = function () {
        var settings = $rootScope.Helium.settings;

        //Availability Threshold Mode - Set reserved state x minutes before a meeting starts
        var availabilityThresholdModeEnabled = settings.room && settings.room.availabilityThresholdRoomState;
        var availabilityThresholdMin =
          settings.room && settings.room.availabilityThresholdMin
            ? settings.room.availabilityThresholdMin
            : 0;
        var availablilityThresholdStateActive = false;

        //Set Reserved state if next meeting is checked in
        var checkInBeforeMinutes = 0;
        var checkInEnabled = settings.automation && settings.automation.forceOrgCheckIn;
        if (checkInEnabled) {
          checkInBeforeMinutes =
            settings.automation && settings.automation.forceOrgCheckInMin
              ? settings.automation.forceOrgCheckInMin
              : 0;
        }
        var reservedColorForCheckInEnabled = checkInEnabled && settings.display && settings.display.reservedColorForCheckedIn;
        var reservedColorForCheckInStateActive = false;

        var now = new Date().getTime();
        var currentEvent = $rootScope.Helium.values.mainRoom.currentEvent;
        var nextEvent = $rootScope.Helium.values.mainRoom.nextEvent;
        var totalMinLeftUntilNextEvent = nextEvent
          ? DatetimeFactory.getTotalMinutesBetweenDates(now, nextEvent.dtStart)
          : DatetimeFactory.getTotalMinutesBetweenDates(now, DatetimeFactory.getMidnightTommorrow());

        if (availabilityThresholdModeEnabled) {
          //If enabled, and next meeting starts within the threshold, set next meeting as current meeting
          if (angular.isNumber(availabilityThresholdMin) && totalMinLeftUntilNextEvent <= availabilityThresholdMin) {
            console.log('AppStateService: setRoomReserved: Within Availability Thrershold');
            availablilityThresholdStateActive = true;
          }
        }

        if (reservedColorForCheckInEnabled) {
          if (angular.isNumber(checkInBeforeMinutes) && totalMinLeftUntilNextEvent <= checkInBeforeMinutes) {
            if (nextEvent && nextEvent.checkedIn) {
              console.log('AppStateService: setRoomReserved: Next event checked in');
              reservedColorForCheckInStateActive = true;
            }
          }
        }

        //If in the Available state, check for coditions to force the Reserved state
        if ($rootScope.Helium.state.isAvailable()) {
          if (availablilityThresholdStateActive || reservedColorForCheckInStateActive) {
            console.log('AppStateService: setRoomReserved: Availability Threshold State active or Next Meeting is Checked In. Set reserved');
            TimelineService.setCurrentEvent(nextEvent);
          }
        }
        //If the UI is already in a forced Reserved state, check for conditions to revert to Available
        else if ($rootScope.Helium.state.isReserved() && (nextEvent && currentEvent) && (nextEvent.id === currentEvent.id)) {
          if (!availablilityThresholdStateActive && !reservedColorForCheckInStateActive) {
            console.log('AppStateService: setRoomReserved: Availability Threshold State NOT active or enabled, and Reserved State for Checked In NOT active or enabled. Set available');
            TimelineService.setCurrentEvent(null);
          }
        }

        return false;
      };
    };
  }
})();
