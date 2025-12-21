
import React from 'react';
import type { Models } from 'node-appwrite';
import { ResourceTable } from '../ui/ResourceTable';
import { Breadcrumb } from '../ui/Breadcrumb';
import { ExternalLinkIcon } from '../../Icons';
import { consoleLinks } from '../../../services/appwrite';
import type { AppwriteProject } from '../../../types';

interface TeamsTabProps {
    activeProject: AppwriteProject;
    teams: Models.Team<any>[];
    selectedTeam: Models.Team<any> | null;
    memberships: Models.Membership[];
    onCreateTeam: () => void;
    onDeleteTeam: (t: Models.Team<any>) => void;
    onSelectTeam: (t: Models.Team<any> | null) => void;
    onCreateMembership: () => void;
    onDeleteMembership: (m: Models.Membership) => void;
}

export const TeamsTab: React.FC<TeamsTabProps> = ({ 
    activeProject, teams, selectedTeam, memberships, 
    onCreateTeam, onDeleteTeam, onSelectTeam, 
    onCreateMembership, onDeleteMembership 
}) => {
    if (!selectedTeam) {
        return (
            <ResourceTable<Models.Team<any>> 
                title="Teams" 
                data={teams} 
                onCreate={onCreateTeam} 
                onDelete={onDeleteTeam} 
                onSelect={(item) => onSelectTeam(item)} 
                createLabel="New Team" 
                extraActions={
                    <a 
                        href={consoleLinks.teams(activeProject)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-bold text-gray-300 transition-all mr-2"
                    >
                        <ExternalLinkIcon size={14} /> Open in Console
                    </a>
                }
            />
        );
    }

    return (
        <>
            <div className="flex justify-between items-start">
                <Breadcrumb items={[{ label: 'Teams', onClick: () => onSelectTeam(null) }, { label: selectedTeam.name }]} />
                <a 
                    href={consoleLinks.teams(activeProject)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-bold text-gray-300 transition-all"
                >
                    <ExternalLinkIcon size={14} /> View in Console
                </a>
            </div>
            <ResourceTable<Models.Membership> 
                title="Memberships" 
                data={memberships} 
                onCreate={onCreateMembership} 
                onDelete={onDeleteMembership} 
                createLabel="Invite Member"
                renderName={(m) => <div><div className="text-gray-200">{m.userName || m.userEmail}</div><div className="text-xs text-gray-500">{m.userEmail}</div></div>}
                renderExtra={(m) => <div className="flex gap-1">{m.roles.map(r => <span key={r} className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded text-gray-300">{r}</span>)}</div>}
                headers={['ID', 'User', 'Roles', 'Actions']}
            />
        </>
    );
};
