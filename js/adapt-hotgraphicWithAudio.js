/*
 * adapt-hotgraphicWithAudio
 * License - http://github.com/BATraining/adapt-hotgraphicWithAudio/blob/master/LICENSE
 * Maintainers - Kevin Corry <kevinc@learningpool.com>, Daryl Hedley <darylhedley@hotmail.com>
 *               Shahfaisal Patel <shahfaisal.patel@exultcorp.com>
 */
define(function(require) {

    var ComponentView = require('coreViews/componentView');
    var Adapt = require('coreJS/adapt');
    var mep = require('components/adapt-hotgraphicWithAudio/js/mediaelement-and-player.min');

    var HotGraphicWithAudio = ComponentView.extend({

        initialize: function() {
            this.listenTo(Adapt, 'remove', this.remove);
            this.listenTo(this.model, 'change:_isVisible', this.toggleVisibility);
            this.model.set('_globals', Adapt.course.get('_globals'));
            this.preRender();
            if (Adapt.device.screenSize == 'large') {
                this.render();
            } else {
                this.reRender();
            }
        },

        events: function() {
            return {
                'click .hotgraphicWithAudio-graphic-pin': 'openHotGraphic',
                'click .hotgraphicWithAudio-popup-done': 'closeHotGraphic',
                'click .hotgraphicWithAudio-popup-nav .back': 'previousHotGraphic',
                'click .hotgraphicWithAudio-popup-nav .next': 'nextHotGraphic',
                'click .hotgraphicWithAudio-popup-audio': 'onClickAudioButton'
            }
        },

        preRender: function() {
            this.listenTo(Adapt, 'device:changed', this.reRender, this);

            // Checks to see if the hotgraphic should be reset on revisit
            this.checkIfResetOnRevisit();
        },

        postRender: function() {
            this.renderState();
            this.$('.component-inner').on('inview', _.bind(this.inview, this));
            this.$('.hotgraphicWithAudio-widget').imageready(_.bind(function() {
                this.setReadyStatus();

                if($('html').hasClass('ie8')) {
                    _.each(this.$('.hotgraphicWithAudio-graphic-pin'), function(item, index) {
                        _.each(this.$(item).find('audio'), function(audioItem, audioItemIndex) {
                            var audioObject = new MediaElementPlayer($(audioItem));
                            this.model.get("_items")[index]._page[audioItemIndex].audioObject = audioObject;
                        }, this);
                    }, this);
                }
            }, this));

            this.$('.mejs-container').addClass('display-none');

            this.$('audio').on('ended', _.bind(this.onAudioEnded, this));
        },

        inview: function(event, visible, visiblePartX, visiblePartY) {
            if (!visible) {
                if($('html').hasClass('ie8')) {
                    this.stopAudio();
                } else {
                    this.stopCurrentAudio();
                }
                this.$('.hotgraphicWithAudio-popup-sound').addClass('icon-sound-mute');
            }
        },

        // Used to check if the hotgraphic should reset on revisit
        checkIfResetOnRevisit: function() {
            var isResetOnRevisit = this.model.get('_isResetOnRevisit');

            // If reset is enabled set defaults
            if (isResetOnRevisit) {
                this.model.reset(isResetOnRevisit);
                _.each(this.model.get('_items'), function(item) {
                    item._isVisited = false;
                });
            }
        },

        reRender: function() {
            if (Adapt.device.screenSize != 'large') {
                this.replaceWithNarrative();
            }
        },

        replaceWithNarrative: function() {
            if (!Adapt.componentStore.narrativeWithAudio) throw "Narrative not included in build";
            var Narrative = Adapt.componentStore.narrativeWithAudio;
            var model = this.prepareNarrativeModel();
            var newNarrative = new Narrative({model: model, $parent: this.options.$parent});
            newNarrative.reRender();
            newNarrative.setupNarrative();
            this.options.$parent.append(newNarrative.$el);
            Adapt.trigger('device:resize');
            this.remove();
        },

        prepareNarrativeModel: function() {
            var model = this.model;
            model.set('_component', 'narrativeWithAudio');
            model.set('_wasHotgraphic', true);
            model.set('originalBody', model.get('body'));
            model.set('originalInstruction', model.get('instruction'));
            if (model.get('mobileBody')) {
                model.set('body', model.get('mobileBody'));
            }
            if (model.get('mobileInstruction')) {
                model.set('instruction', model.get('mobileInstruction'));
            }

            return model;
        },

        applyNavigationClasses: function (index) {
            var $nav = this.$('.hotgraphicWithAudio-popup-nav'),
                pageCount = this.$('.hotgraphicWithAudio-item.active').find('.hotgraphicWithAudio-page').length;

            $nav.removeClass('first last');
            this.$('.hotgraphicWithAudio-popup-done').a11y_cntrl_enabled(true);
            if(index <= 0) {
                this.$('.hotgraphicWithAudio-popup-nav').addClass('first');
                this.$('.hotgraphicWithAudio-popup-controls.back').a11y_cntrl_enabled(false);
                this.$('.hotgraphicWithAudio-popup-controls.next').a11y_cntrl_enabled(true);
            } else if (index >= pageCount-1) {
                this.$('.hotgraphicWithAudio-popup-nav').addClass('last');
                this.$('.hotgraphicWithAudio-popup-controls.back').a11y_cntrl_enabled(true);
                this.$('.hotgraphicWithAudio-popup-controls.next').a11y_cntrl_enabled(false);
            } else {
                this.$('.hotgraphicWithAudio-popup-controls.back').a11y_cntrl_enabled(true);
                this.$('.hotgraphicWithAudio-popup-controls.next').a11y_cntrl_enabled(true);
            }
        },

        openHotGraphic: function (event) {
            event.preventDefault();
            this.$('.hotgraphicWithAudio-popup-inner').a11y_on(false);
            var currentHotSpot = $(event.currentTarget).data('id');
            this.$('.hotgraphicWithAudio-item').hide().removeClass('active');
            var $currentHotSpotItem = this.$('.'+currentHotSpot).show().addClass('active');
            var currentHotspotIndex = $currentHotSpotItem.index();

            this.$('.hotgraphicWithAudio-page').hide().removeClass('activePage');
            $currentHotSpotItem.find('.hotgraphicWithAudio-page').eq(0).addClass('activePage').show();

            this.setVisited(currentHotspotIndex);

            this.$('.hotgraphicWithAudio-popup-count .current').html(1);
            this.$('.hotgraphicWithAudio-popup-count .total').html(this.model.get('_items')[currentHotspotIndex]._page.length);
            this.$('.hotgraphicWithAudio-popup').show();
            this.$('.hotgraphicWithAudio-popup-inner .active').a11y_on(true);

            Adapt.trigger('popup:opened',  this.$('.hotgraphicWithAudio-popup-inner'));

            this.$('.hotgraphicWithAudio-popup-inner .active').a11y_focus();
            this.applyNavigationClasses(0);
            this.$('.hotgraphicWithAudio-popup-sound').removeClass('icon-sound-mute');

            if($('html').hasClass('ie8')) {
                this.playAudioAtIndex(currentHotspotIndex, 0);
            } else {
                var audioElement = this.$('.hotgraphicWithAudio-graphic-pin').eq(currentHotspotIndex).find('audio')[0];
                this.playAudioForElement(audioElement);
            }
        },

        nextHotGraphic: function (event) {
            event.preventDefault();
            var $activeHotSpotItem = this.$('.hotgraphicWithAudio-item.active');
            var $currentPages = $activeHotSpotItem.find('.hotgraphicWithAudio-page');
            var $currentActivePage = $activeHotSpotItem .find('.hotgraphicWithAudio-page.activePage');
            var activePageIndex = $currentPages.index($currentActivePage);

            if (activePageIndex < ($currentPages.length-1)) {
                $currentActivePage.removeClass('activePage').hide();
                $currentPages.eq(activePageIndex + 1).addClass('activePage').show();
                this.$('.hotgraphicWithAudio-popup-count .current').html(activePageIndex+2);
                this.$('.hotgraphicWithAudio-popup-inner').a11y_on(false);
            }
            this.applyNavigationClasses(activePageIndex+1);
            this.$('.hotgraphicWithAudio-popup-inner .active').a11y_on(true);
            this.$('.hotgraphicWithAudio-popup-inner .active').a11y_focus();

            newActivePageIndex = $currentPages.index(this.$('.hotgraphicWithAudio-page.activePage'));
            if (newActivePageIndex != activePageIndex) {
                if($('html').hasClass('ie8')) {
                    this.playAudioAtIndex($activeHotSpotItem.index(), newActivePageIndex);
                } else {
                    var audioElement = this.$('.hotgraphicWithAudio-graphic-pin').eq($activeHotSpotItem.index()).find('audio')[newActivePageIndex];
                    this.playAudioForElement(audioElement);
                }
            }
            this.$('.hotgraphicWithAudio-popup-sound').removeClass('icon-sound-mute');
        },

        previousHotGraphic: function (event) {
            event.preventDefault();
            var $activeHotSpotItem = this.$('.hotgraphicWithAudio-item.active');
            var $currentPages = $activeHotSpotItem.find('.hotgraphicWithAudio-page');
            var $currentActivePage = $activeHotSpotItem .find('.hotgraphicWithAudio-page.activePage');
            var activePageIndex = $currentPages.index($currentActivePage);

            if (activePageIndex > 0) {
                $currentActivePage.hide().removeClass('activePage');
                $currentPages.eq(activePageIndex - 1).show().addClass('activePage');
                this.$('.hotgraphicWithAudio-popup-count .current').html(activePageIndex);
                this.$('.hotgraphicWithAudio-popup-inner').a11y_on(false);
            }
            this.applyNavigationClasses(activePageIndex-1);
            this.$('.hotgraphicWithAudio-popup-inner .active').a11y_on(true);
            this.$('.hotgraphicWithAudio-popup-inner .active').a11y_focus();

            var newActivePageIndex = $currentPages.index(this.$('.hotgraphicWithAudio-page.activePage'));
            if (newActivePageIndex != activePageIndex) {
                if($('html').hasClass('ie8')) {
                   this.playAudioAtIndex($activeHotSpotItem.index(), newActivePageIndex);
                } else {
                    var audioElement = this.$('.hotgraphicWithAudio-graphic-pin').eq($activeHotSpotItem.index()).find('audio')[newActivePageIndex];
                    this.playAudioForElement(audioElement);
                }
            }
            this.$('.hotgraphicWithAudio-popup-sound').removeClass('icon-sound-mute');
        },

        onClickAudioButton:function(event){
            if(event && event.preventDefault) event.preventDefault();
            var audioElement = this.model.get("_currentAudioElement");
            if(audioElement==''){
                var curIndex = this.$('.hotgraphicWithAudio-page').index(this.$('.hotgraphicWithAudio-page.activePage'));
                if($('html').hasClass('ie8')) {
                    this.playAudioAtIndex(this.$('.hotgraphicWithAudio-item.active').index(), curIndex);
                } else {
                    var audioElement = this.$('.hotgraphicWithAudio-item-audio audio').eq(curIndex)[0];
                    this.playAudioForElement(audioElement);
                }
                this.$('.hotgraphicWithAudio-popup-sound').removeClass('icon-sound-mute');
            }else {
                if($('html').hasClass('ie8')) {
                    this.stopAudio();
                } else {
                    this.stopCurrentAudio();
                }
                this.$('.hotgraphicWithAudio-popup-sound').addClass('icon-sound-mute');
            }
        },

        closeHotGraphic: function(event) {
            event.preventDefault();
            this.$('.hotgraphicWithAudio-page').hide().removeClass('activePage');
            this.$('.hotgraphicWithAudio-popup').hide();
            Adapt.trigger('popup:closed',  this.$('.hotgraphicWithAudio-popup-inner'));
            if($('html').hasClass('ie8')) {
                this.stopAudio();
            } else {
                this.stopCurrentAudio();
            }
        },

        onAudioEnded: function(event) {
            if($('html').hasClass('ie8')) {
                this.stopAudio();
            } else {
                this.model.get("_currentAudioElement").currentTime = 0.0;
                this.model.set("_currentAudioElement", '');
            }
            this.$('.hotgraphicWithAudio-popup-sound').addClass('icon-sound-mute');
        },

        playAudioAtIndex: function (currentItemIndex, currentPageIndex) {
            var item = (currentItemIndex >= 0) ? this.model.get("_items")[currentItemIndex] : null;
            var audioObject = item && item._page && (currentPageIndex >= 0) ? item._page[currentPageIndex].audioObject : null;
            if(audioObject) {
                audioObject.play();
                this.model.set("_currentAudioIndexObject", {
                    currentItemIndex: currentItemIndex,
                    currentPageIndex: currentPageIndex
                });
            }
        },

        stopAudio: function () {
            var currentAudioIndexObject = this.model.get("_currentAudioIndexObject");
            var currentItemIndex = currentAudioIndexObject ? currentAudioIndexObject.currentItemIndex : null;
            var currentPageIndex = currentAudioIndexObject ? currentAudioIndexObject.currentPageIndex : null;
            var item = (currentItemIndex >= 0) ? this.model.get("_items")[currentItemIndex] : null;
            var audioObject = item && item._page && (currentPageIndex >= 0) ? item._page[currentPageIndex].audioObject : null;

            if(audioObject) {
                audioObject.setCurrentTime(0);
                audioObject.pause();
                this.model.set("_currentAudioObjectIndex", {});
            }
        },

        playAudioForElement: function(audioElement) {
            if (audioElement) {
                this.stopCurrentAudio();
                this.model.set("_currentAudioElement", audioElement);
                if(audioElement.play) audioElement.play();
            }
        },

        stopCurrentAudio: function() {
            var audioElement = this.model.get("_currentAudioElement");
            if (audioElement) {
                if (!audioElement.paused && audioElement.pause) {
                    audioElement.pause();
                }
                if (audioElement.currentTime != 0) {
                    audioElement.currentTime = 0.0;
                }
                if($('html').hasClass('ie8')) {
                    if (audioElement.getCurrentTime() != 0) {
                        audioElement.setCurrentTime(0);
                    }
                }
                this.model.set("_currentAudioElement", '');
            }
        },

        setVisited: function(index) {
            var item = this.model.get('_items')[index];
            item._isVisited = true;
            this.$('.hotgraphicWithAudio-graphic-pin').eq(index).addClass('visited').attr('aria-label', "Item visited.");
            $.a11y_alert("visited");
            this.checkCompletionStatus();
        },

        getVisitedItems: function() {
            return _.filter(this.model.get('_items'), function(item) {
                return item._isVisited;
            });
        },

        checkCompletionStatus: function() {
            if (!this.model.get('_isComplete')) {
                if (this.getVisitedItems().length == this.model.get('_items').length) {
                    this.setCompletionStatus();
                }
            }
        }

    });

    Adapt.register('hotgraphicWithAudio', HotGraphicWithAudio);

    return HotGraphicWithAudio;

});
