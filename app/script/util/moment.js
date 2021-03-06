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

moment.fn.is_today = function() {
  return this.isSame(new Date(), 'd');
};

moment.fn.is_current_year = function() {
  return this.isSame(new Date(), 'y');
};

moment.fn.is_same_day = function(date) {
  return this.isSame(date, 'd');
};

moment.fn.is_same_month = function(date) {
  return this.isSame(date, 'M');
};
