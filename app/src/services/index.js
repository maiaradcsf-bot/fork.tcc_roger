import * as authService from './authService.js';
import * as adminCatalogService from './admin/catalogService.js';
import * as adminStockService from './admin/stockService.js';
import * as adminOrdersService from './admin/ordersService.js';
import * as adminSettingsService from './admin/settingsService.js';
import * as clientService from './clientService.js';

export { ApiError } from '../api/ApiError.js';
export { ROLES, getToken, hasToken, clearAllTokens } from '../api/tokenStorage.js';
export { API_BASE_URL, API_HOST } from '../config/env.js';
export { ORDER_ACTIONS } from './admin/ordersService.js';

export const api = {
  auth: authService,
  admin: {
    catalog: adminCatalogService,
    stock: adminStockService,
    orders: adminOrdersService,
    settings: adminSettingsService,
  },
  client: clientService,
};

export { authService, adminCatalogService, adminStockService, adminOrdersService, adminSettingsService, clientService };
