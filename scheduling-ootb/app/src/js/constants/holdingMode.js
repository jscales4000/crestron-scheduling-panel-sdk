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
                    // Each phrase must fit within two rendered lines. The
                    // .holding__message slot in src/scss/partials/holding.scss
                    // is a fixed height: 9vh (two lines at 3vh / 1.3
                    // line-height) - a third line overflows the
                    // absolutely-positioned slot and collides with the
                    // footer (room name / clock / date). Raise that height
                    // first if longer copy is ever needed.
                    phrases: [
                        'Pardon our dust while we move in.',
                        'Scheduling coming soon.'
                    ]
                }
            }
        });
})();
