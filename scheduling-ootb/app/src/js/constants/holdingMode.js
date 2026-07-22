/**
 * Holding Mode
 *
 * Single source of truth for the MCCCD District Office holding screen.
 * Set `enabled` to false to restore the stock scheduling application.
 */
(function () {
    'use strict';

    angular
        .module('helium')
        .constant('HoldingMode', {
            // Master switch. false => stock scheduling app, unmodified behaviour.
            enabled: true,

            // Page name registered at views/partials/<page>.html
            page: 'holding',

            // Pages redirected to the holding screen while enabled.
            interceptedPages: ['room', 'screensaver'],

            // Cross-fade cadence for the message slot, milliseconds.
            phraseIntervalMs: 8000,

            // Site-specific copy. Keyed by two-letter language, 'en' is the fallback.
            // Deliberately NOT in assets/translations/*.json - that is product UI
            // text across ~30 files; this is one site's signage.
            copy: {
                en: {
                    greeting: 'Welcome to the new District Office',
                    phrases: [
                        'Pardon our dust while we move in.',
                        'Scheduling coming soon.'
                    ]
                }
            }
        });
})();
