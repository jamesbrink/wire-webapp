/*
 * Wire
 * Copyright (C) 2018 Wire Swiss GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 *
 */

'use strict';

window.z = window.z || {};
window.z.viewModel = z.viewModel || {};
window.z.viewModel.content = z.viewModel.content || {};

z.viewModel.content.PreferencesAccountViewModel = class PreferencesAccountViewModel {
  static get SAVED_ANIMATION_TIMEOUT() {
    return 750 * 2;
  }

  constructor(mainViewModel, contentViewModel, repositories) {
    this.changeAccentColor = this.changeAccentColor.bind(this);
    this.check_new_clients = this.check_new_clients.bind(this);
    this.removed_from_view = this.removed_from_view.bind(this);

    this.logger = new z.util.Logger('z.viewModel.content.PreferencesAccountViewModel', z.config.LOGGER.OPTIONS);

    this.clientRepository = repositories.client;
    this.teamRepository = repositories.team;
    this.userRepository = repositories.user;

    this.selfUser = this.userRepository.self;
    this.newClients = ko.observableArray([]);
    this.name = ko.pureComputed(() => this.selfUser().name());
    this.availability = ko.pureComputed(() => this.selfUser().availability());

    this.availabilityLabel = ko.pureComputed(() => {
      let label = z.user.AvailabilityMapper.nameFromType(this.availability());

      const noStatusSet = this.availability() === z.user.AvailabilityType.NONE;
      if (noStatusSet) {
        label = z.l10n.text(z.string.preferencesAccountAvaibilityUnset);
      }

      return label;
    });

    this.username = ko.pureComputed(() => this.selfUser().username());
    this.enteredUsername = ko.observable();
    this.submittedUsername = ko.observable();
    this.usernameError = ko.observable();

    this.isTeam = this.teamRepository.isTeam;
    this.isTeamManager = ko.pureComputed(() => this.isTeam() && this.selfUser().isTeamManager());
    this.team = this.teamRepository.team;
    this.teamName = ko.pureComputed(() => {
      return z.l10n.text(z.string.preferencesAccountTeam, this.teamRepository.teamName());
    });

    this.nameSaved = ko.observable();
    this.usernameSaved = ko.observable();

    this._initSubscriptions();
  }

  _initSubscriptions() {
    amplify.subscribe(z.event.WebApp.USER.CLIENT_ADDED, this.onClientAdd.bind(this));
    amplify.subscribe(z.event.WebApp.USER.CLIENT_REMOVED, this.onClientRemove.bind(this));
  }

  removedFromView() {
    this._resetUsernameInput();
  }

  changeAccentColor(id) {
    this.userRepository.changeAccentColor(id);
  }

  changeName(viewModel, event) {
    const newName = event.target.value.trim();

    const isUnchanged = newName === this.selfUser().name();
    if (isUnchanged) {
      return event.target.blur();
    }

    if (newName.length >= z.user.UserRepository.CONFIG.MINIMUM_NAME_LENGTH) {
      this.userRepository.changeName(newName).then(() => {
        this.nameSaved(true);
        event.target.blur();
        window.setTimeout(() => this.nameSaved(false), PreferencesAccountViewModel.SAVED_ANIMATION_TIMEOUT);
      });
    }
  }

  resetNameInput() {
    if (!this.nameSaved()) {
      this.name.notifySubscribers();
    }
  }

  resetUsernameInput() {
    if (!this.usernameSaved()) {
      this._resetUsernameInput();
      this.username.notifySubscribers();
    }
  }

  shouldFocusUsername() {
    return this.userRepository.should_set_username;
  }

  checkUsernameInput(username, keyboardEvent) {
    if (z.util.KeyboardUtil.isKey(keyboardEvent, z.util.KeyboardUtil.KEY.BACKSPACE)) {
      return true;
    }

    // Automation: KeyboardEvent triggered during tests is missing key property
    const inputChar = keyboardEvent.key || String.fromCharCode(event.charCode);
    return z.user.UserHandleGenerator.validate_character(inputChar.toLowerCase());
  }

  clickOnAvailability(viewModel, event) {
    z.ui.AvailabilityContextMenu.show(event, 'settings', 'preferences-account-availability-menu');
  }

  changeUsername(username, event) {
    const enteredUsername = event.target.value;
    const normalizedUsername = enteredUsername.toLowerCase().replace(/[^a-z0-9_]/g, '');

    const wasNormalized = enteredUsername !== normalizedUsername;
    if (wasNormalized) {
      event.target.value = normalizedUsername;
    }

    if (normalizedUsername.length < z.user.UserRepository.CONFIG.MINIMUM_USERNAME_LENGTH) {
      return this.usernameError(null);
    }

    const isUnchanged = normalizedUsername === this.selfUser().username();
    if (isUnchanged) {
      return event.target.blur();
    }

    this.submittedUsername(normalizedUsername);
    this.userRepository
      .changeUsername(normalizedUsername)
      .then(() => {
        if (this.enteredUsername() === this.submittedUsername()) {
          this.usernameError(null);
          this.usernameSaved(true);

          event.target.blur();
          window.setTimeout(() => this.usernameSaved(false), PreferencesAccountViewModel.SAVED_ANIMATION_TIMEOUT);
        }
      })
      .catch(error => {
        const isUsernameTaken = error.type === z.user.UserError.TYPE.USERNAME_TAKEN;
        const isCurrentRequest = this.enteredUsername() === this.submittedUsername();
        if (isUsernameTaken && isCurrentRequest) {
          this.usernameError('taken');
        }
      });
  }

  verifyUsername(username, event) {
    const enteredUsername = event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');

    const usernameTooShort = enteredUsername.length < z.user.UserRepository.CONFIG.MINIMUM_USERNAME_LENGTH;
    const usernameUnchanged = enteredUsername === this.selfUser().username();
    if (usernameTooShort || usernameUnchanged) {
      return this.usernameError(null);
    }

    this.enteredUsername(enteredUsername);

    if (z.user.UserHandleGenerator.validate_handle(enteredUsername)) {
      this.userRepository
        .verify_username(enteredUsername)
        .then(() => {
          const isCurrentRequest = this.enteredUsername() === enteredUsername;
          if (isCurrentRequest) {
            this.usernameError('available');
          }
        })
        .catch(error => {
          const isUsernameTaken = error.type === z.user.UserError.TYPE.USERNAME_TAKEN;
          const isCurrentRequest = this.enteredUsername() === enteredUsername;
          if (isUsernameTaken && isCurrentRequest) {
            this.usernameError('taken');
          }
        });
    }
  }

  checkNewClients() {
    if (this.newClients().length) {
      amplify.publish(z.event.WebApp.SEARCH.BADGE.HIDE);

      amplify.publish(z.event.WebApp.WARNING.MODAL, z.viewModel.ModalsViewModel.TYPE.ACCOUNT_NEW_DEVICES, {
        close: () => this.newClients.removeAll(),
        data: this.newClients(),
        preventClose: true,
        secondary: () => {
          amplify.publish(z.event.WebApp.CONTENT.SWITCH, z.viewModel.ContentViewModel.STATE.PREFERENCES_DEVICES);
        },
      });
    }
  }

  clickOnChangePicture(files) {
    const [newUserPicture] = Array.from(files);

    this.setPicture(newUserPicture).catch(error => {
      const isInvalidUpdate = error.type === z.user.UserError.TYPE.INVALID_UPDATE;
      if (!isInvalidUpdate) {
        throw error;
      }
    });
  }

  clickOnDeleteAccount() {
    amplify.publish(z.event.WebApp.WARNING.MODAL, z.viewModel.ModalsViewModel.TYPE.CONFIRM, {
      action: () => this.userRepository.delete_me(),
      text: {
        action: z.l10n.text(z.string.modalAccountDeletionAction),
        message: z.l10n.text(z.string.modalAccountDeletionMessage),
        title: z.l10n.text(z.string.modalAccountDeletionHeadline),
      },
    });
  }

  clickOnCreate() {
    const path = `${z.l10n.text(z.string.urlWebsiteCreateTeam)}?pk_campaign=client&pk_kwd=desktop`;
    z.util.safe_window_open(z.util.URLUtil.build_url(z.util.URLUtil.TYPE.WEBSITE, path));
  }

  clickOnLogout() {
    this.clientRepository.logoutClient();
  }

  clickOnManage() {
    const path = `${z.config.URL_PATH.MANAGE_TEAM}?utm_source=client_settings&utm_term=desktop`;
    z.util.safe_window_open(z.util.URLUtil.build_url(z.util.URLUtil.TYPE.TEAM_SETTINGS, path));
    amplify.publish(z.event.WebApp.ANALYTICS.EVENT, z.tracking.EventName.SETTINGS.OPENED_MANAGE_TEAM);
  }

  clickOnResetPassword() {
    z.util.safe_window_open(z.util.URLUtil.build_url(z.util.URLUtil.TYPE.ACCOUNT, z.config.URL_PATH.PASSWORD_RESET));
  }

  setPicture(newUserPicture) {
    if (newUserPicture.size > z.config.MAXIMUM_IMAGE_FILE_SIZE) {
      const maximumSizeInMB = z.config.MAXIMUM_IMAGE_FILE_SIZE / 1024 / 1024;
      const messageString = z.l10n.text(z.string.modalPictureTooLargeMessage, maximumSizeInMB);
      const titleString = z.l10n.text(z.string.modalPictureTooLargeHeadline);

      return this._showUploadWarning(titleString, messageString);
    }

    if (!z.config.SUPPORTED_PROFILE_IMAGE_TYPES.includes(newUserPicture.type)) {
      const titleString = z.l10n.text(z.string.modalPictureFileFormatHeadline);
      const messageString = z.l10n.text(z.string.modalPictureFileFormatMessage);

      return this._showUploadWarning(titleString, messageString);
    }

    const min_height = z.user.UserRepository.CONFIG.MINIMUM_PICTURE_SIZE.HEIGHT;
    const min_width = z.user.UserRepository.CONFIG.MINIMUM_PICTURE_SIZE.WIDTH;

    return z.util.valid_profile_image_size(newUserPicture, min_width, min_height).then(valid => {
      if (valid) {
        return this.userRepository.change_picture(newUserPicture);
      }

      const messageString = z.l10n.text(z.string.modalPictureTooSmallMessage);
      const titleString = z.l10n.text(z.string.modalPictureTooSmallHeadline);
      return this._showUploadWarning(titleString, messageString);
    });
  }

  _showUploadWarning(title, message) {
    const modalOptions = {text: {message, title}};
    amplify.publish(z.event.WebApp.WARNING.MODAL, z.viewModel.ModalsViewModel.TYPE.ACKNOWLEDGE, modalOptions);

    return Promise.reject(new z.user.UserError(z.user.UserError.TYPE.INVALID_UPDATE));
  }

  onClientAdd(userId, clientEntity) {
    const isSelfUser = userId === this.selfUser().id;
    if (isSelfUser) {
      amplify.publish(z.event.WebApp.SEARCH.BADGE.SHOW);
      this.newClients.push(clientEntity);
    }
  }

  onClientRemove(userId, clientId) {
    const isSelfUser = userId === this.selfUser().id;
    if (isSelfUser) {
      this.newClients.remove(clientEntity => {
        const isExpectedId = clientEntity.id === clientId;
        return isExpectedId && clientEntity.isPermanent();
      });

      if (!this.newClients().length) {
        amplify.publish(z.event.WebApp.SEARCH.BADGE.HIDE);
      }
    }
    return true;
  }

  _resetUsernameInput() {
    this.usernameError(null);
    this.enteredUsername(null);
    this.submittedUsername(null);
  }
};
