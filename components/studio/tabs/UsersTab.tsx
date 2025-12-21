
import React from 'react';
import type { Models } from 'node-appwrite';
import { ResourceTable } from '../ui/ResourceTable';
import { ExternalLinkIcon } from '../../Icons';
import { consoleLinks } from '../../../services/appwrite';
import type { AppwriteProject } from '../../../types';

interface UsersTabProps {
    activeProject: AppwriteProject;
    users: Models.User<any>[];
    onCreateUser: () => void;
    onDeleteUser: (u: Models.User<any>) => void;
}

export const UsersTab: React.FC<UsersTabProps> = ({ activeProject, users, onCreateUser, onDeleteUser }) => {
    return (
        <ResourceTable<Models.User<any>> 
            title="Users" 
            data={users} 
            onCreate={onCreateUser} 
            onDelete={onDeleteUser} 
            createLabel="New User"
            extraActions={
                <a 
                    href={consoleLinks.users(activeProject)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-bold text-gray-300 transition-all mr-2"
                >
                    <ExternalLinkIcon size={14} /> Open in Console
                </a>
            }
            renderName={(u) => <div><div className="font-medium text-gray-200">{u.name || 'No Name'}</div><div className="text-xs text-gray-500">{u.email}</div></div>}
            renderExtra={(u) => <span className={`text-[10px] ${u.status ? 'text-green-500' : 'text-red-500'}`}>{u.status ? 'Verified' : 'Unverified'}</span>}
            headers={['ID', 'User', 'Status', 'Actions']}
        />
    );
};
