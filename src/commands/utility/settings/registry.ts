import type { SettingsModuleRegistry, SettingsCategoryModule, SettingsAction } from './types.js';
import { accessModule } from './accessModule.js';
import { promptModule } from './promptModule.js';
import { channelModule } from './channelModule.js';

export const settingsRegistry: SettingsModuleRegistry = {
	access: accessModule,
	prompt: promptModule,
	channel: channelModule,
};

export function getAllCategories(): Array<{ name: string; value: string }> {
	return Object.values(settingsRegistry).map((module) => ({
		name: module.name,
		value: module.value,
	}));
}

export function getAllActions(): SettingsAction[] {
	const actionMap = new Map<string, SettingsAction>();

	Object.values(settingsRegistry).forEach((module) => {
		module.actions.forEach((action) => {
			actionMap.set(action.value, action);
		});
	});

	return Array.from(actionMap.values());
}

export function getActionsForCategory(categoryValue: string): SettingsAction[] {
	const module = settingsRegistry[categoryValue];
	return module ? module.actions : [];
}

export function getModule(categoryValue: string): SettingsCategoryModule | undefined {
	return settingsRegistry[categoryValue];
}

export function isActionAllowedForCategory(categoryValue: string, action: string): boolean {
	const module = settingsRegistry[categoryValue];
	return module ? module.isActionAllowed(action) : false;
}
