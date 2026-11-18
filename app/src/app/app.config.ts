import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { SafeErrorHandler } from './safe-error-handler';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [{ provide: ErrorHandler, useClass: SafeErrorHandler }, provideBrowserGlobalErrorListeners(), provideRouter(routes, withInMemoryScrolling({ anchorScrolling: 'enabled' })), provideHttpClient()],
};
