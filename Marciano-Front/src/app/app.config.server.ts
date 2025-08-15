// src/app/app.config.server.ts
import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { appConfig as baseConfig } from './app.config';
import { provideServerRendering } from '@angular/platform-server';

const serverOnly: ApplicationConfig = {
  providers: [provideServerRendering()],
};

export const appConfig: ApplicationConfig = mergeApplicationConfig(baseConfig, serverOnly);
