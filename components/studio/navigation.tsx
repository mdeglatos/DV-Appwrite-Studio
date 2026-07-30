import React from 'react';
import type { StudioTab } from '../../types';
import type { StudioGroupId } from '../../services/studioNav';
import {
    DashboardIcon, DatabaseIcon, StorageIcon, ErdIcon, FunctionIcon, SitesIcon,
    UserIcon, TeamIcon, MessageIcon, WebhookIcon, HealthIcon, MigrationIcon,
    BackupIcon, SettingsIcon, LinksIcon, ToolsIcon,
} from '../Icons';

import { OverviewTab } from './tabs/OverviewTab';
import { DatabasesTab } from './tabs/DatabasesTab';
import { StorageTab } from './tabs/StorageTab';
import { ErdTab } from './tabs/ErdTab';
import { FunctionsTab } from './tabs/FunctionsTab';
import { SitesTab } from './tabs/SitesTab';
import { UsersTab } from './tabs/UsersTab';
import { TeamsTab } from './tabs/TeamsTab';
import { MessagingTab } from './tabs/MessagingTab';
import { WebhooksTab } from './tabs/WebhooksTab';
import { HealthTab } from './tabs/HealthTab';
import { MigrationsTab } from './tabs/MigrationsTab';
import { BackupsTab } from './tabs/BackupsTab';
import { ProjectSettingsTab } from './tabs/ProjectSettingsTab';

/**
 * The presentation binding for the Studio navigation registry: which icon and
 * which panel component each section renders with.
 *
 * Structure — group membership, ordering, labels and URL segments — is owned by
 * `services/studioNav.ts`. This module owns nothing structural. Both maps are
 * annotated `Record<…>`, so a section without a panel or a group without an icon
 * fails to compile.
 */

export interface StudioSectionUi {
    icon: React.ReactNode;
    Panel: React.ComponentType<any>;
}

/**
 * Declared with `satisfies` rather than a plain annotation so the map stays
 * exhaustive over `StudioTab` **and** each entry keeps its concrete component
 * type — that is what lets `Studio.tsx` typecheck every section's props.
 */
export const STUDIO_SECTION_UI = {
    'overview': { icon: <DashboardIcon size={16} />, Panel: OverviewTab },
    'database': { icon: <DatabaseIcon size={16} />, Panel: DatabasesTab },
    'storage': { icon: <StorageIcon size={16} />, Panel: StorageTab },
    'erd': { icon: <ErdIcon size={16} />, Panel: ErdTab },
    'functions': { icon: <FunctionIcon size={16} />, Panel: FunctionsTab },
    'sites': { icon: <SitesIcon size={16} />, Panel: SitesTab },
    'users': { icon: <UserIcon size={16} />, Panel: UsersTab },
    'teams': { icon: <TeamIcon size={16} />, Panel: TeamsTab },
    'messaging': { icon: <MessageIcon size={16} />, Panel: MessagingTab },
    'webhooks': { icon: <WebhookIcon size={16} />, Panel: WebhooksTab },
    'health': { icon: <HealthIcon size={16} />, Panel: HealthTab },
    'migrations': { icon: <MigrationIcon size={16} />, Panel: MigrationsTab },
    'backups': { icon: <BackupIcon size={16} />, Panel: BackupsTab },
    'project-settings': { icon: <SettingsIcon size={16} />, Panel: ProjectSettingsTab },
} satisfies Record<StudioTab, StudioSectionUi>;

/** Props accepted by each section's registered panel. */
export type StudioSectionProps = {
    [K in StudioTab]: React.ComponentProps<(typeof STUDIO_SECTION_UI)[K]['Panel']>
};

export const STUDIO_GROUP_ICONS: Record<StudioGroupId, React.ReactNode> = {
    'overview': <DashboardIcon size={16} />,
    'data': <DatabaseIcon size={16} />,
    'compute': <FunctionIcon size={16} />,
    'auth': <UserIcon size={16} />,
    'integrations': <LinksIcon size={16} />,
    'operations': <ToolsIcon size={16} />,
    'settings': <SettingsIcon size={16} />,
};
