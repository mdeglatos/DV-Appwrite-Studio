
import React from 'react';
import { IoSend, IoAttach } from 'react-icons/io5';
import { CgSpinner } from 'react-icons/cg';
import { FaUser, FaExternalLinkAlt } from 'react-icons/fa';
import { RiRobot2Line, RiSettings3Line, RiAddCircleLine, RiDeleteBinLine, RiCheckLine, RiCloseLine, RiTerminalBoxLine, RiMenuLine, RiToolsLine, RiLogoutBoxRLine, RiArrowDownSLine, RiArrowUpSLine, RiStackLine, RiFileUploadFill, RiFile3Line, RiKey2Line, RiRefreshLine, RiFileCopyLine, RiCodeSSlashLine, RiCompass3Line, RiErrorWarningLine, RiFolderLine, RiFileAddLine, RiFolderAddLine, RiPencilLine, RiLayoutMasonryLine as _RiLayoutMasonryLine, RiDashboardLine, RiDatabase2Line, RiHardDrive2Line, RiGroupLine, RiFlashlightLine, RiArrowLeftSLine, RiEyeLine, RiShareForwardLine as _RiShareForwardLine, RiRocketLine as _RiRocketLine, RiCommandLine, RiGlobalLine as _RiGlobalLine, RiHistoryLine, RiCloudLine, RiDownloadCloud2Line, RiUploadCloud2Line, RiExternalLinkLine, RiLinksLine, RiPlugLine } from 'react-icons/ri';

interface IconProps {
    size?: number;
    className?: string;
}

export const SendIcon: React.FC<IconProps> = ({ size = 20, className }) => <IoSend size={size} className={className} />;
export const AttachmentIcon: React.FC<IconProps> = ({ size = 20, className }) => <IoAttach size={size} className={className} />;

export const LoadingSpinnerIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <CgSpinner size={size} className={`animate-spin ${className || ''}`} />
);

export const UserIcon: React.FC<IconProps> = ({ size = 20, className }) => <FaUser size={size} className={className} />;

export const BotIcon: React.FC<IconProps> = ({ size = 20, className }) => <RiRobot2Line size={size} className={className} />;

export const SettingsIcon: React.FC<IconProps> = ({ size = 20, className }) => <RiSettings3Line size={size} className={className} />;
export const AddIcon: React.FC<IconProps> = ({ size = 22, className }) => <RiAddCircleLine size={size} className={className} />;
export const DeleteIcon: React.FC<IconProps> = ({ size = 18, className }) => <RiDeleteBinLine size={size} className={className} />;
export const CheckIcon: React.FC<IconProps> = ({ size = 18, className }) => <RiCheckLine size={size} className={className} />;
export const CloseIcon: React.FC<IconProps> = ({ size = 24, className }) => <RiCloseLine size={size} className={className} />;
export const TerminalIcon: React.FC<IconProps> = ({ size = 20, className }) => <RiTerminalBoxLine size={size} className={className} />;
export const MenuIcon: React.FC<IconProps> = ({ size = 24, className }) => <RiMenuLine size={size} className={className} />;
export const ToolsIcon: React.FC<IconProps> = ({ size = 20, className }) => <RiToolsLine size={size} className={className} />;
export const LogoutIcon: React.FC<IconProps> = ({ size = 20, className }) => <RiLogoutBoxRLine size={size} className={className} />;

export const ChevronDownIcon: React.FC<IconProps> = ({ size = 20, className }) => <RiArrowDownSLine size={size} className={className} />;
export const ChevronUpIcon: React.FC<IconProps> = ({ size = 20, className }) => <RiArrowUpSLine size={size} className={className} />;
export const ArrowLeftIcon: React.FC<IconProps> = ({ size = 20, className }) => <RiArrowLeftSLine size={size} className={className} />;
export const ProjectsIcon: React.FC<IconProps> = ({ size = 20, className }) => <RiStackLine size={size} className={className} />;

export const FileUploadIcon: React.FC<IconProps> = ({ size = 48, className }) => <RiFileUploadFill size={size} className={className} />;
export const FileIcon: React.FC<IconProps> = ({ size = 32, className }) => <RiFile3Line size={size} className={className} />;
export const KeyIcon: React.FC<IconProps> = ({ size = 20, className }) => <RiKey2Line size={size} className={className} />;

export const RefreshIcon: React.FC<IconProps> = ({ size = 18, className }) => <RiRefreshLine size={size} className={className} />;
export const CopyIcon: React.FC<IconProps> = ({ size = 16, className }) => <RiFileCopyLine size={size} className={className} />;
export const CodeIcon: React.FC<IconProps> = ({ size = 20, className }) => <RiCodeSSlashLine size={size} className={className} />;
export const SourcesIcon: React.FC<IconProps> = ({ size = 16, className }) => <RiCompass3Line size={size} className={className} />;
export const WarningIcon: React.FC<IconProps> = ({ size = 24, className }) => <RiErrorWarningLine size={size} className={`text-red-400 ${className || ''}`} />;
export const EyeIcon: React.FC<IconProps> = ({ size = 18, className }) => <RiEyeLine size={size} className={className} />;

export const ExternalLinkIcon: React.FC<IconProps> = ({ size = 16, className }) => <RiExternalLinkLine size={size} className={className} />;
export const LinksIcon: React.FC<IconProps> = ({ size = 16, className }) => <RiLinksLine size={size} className={className} />;

// New Icons for Code Viewer
export const FolderIcon: React.FC<IconProps> = ({ size = 16, className }) => <RiFolderLine size={size} className={className} />;
export const FileAddIcon: React.FC<IconProps> = ({ size = 18, className }) => <RiFileAddLine size={size} className={className} />;
export const FolderAddIcon: React.FC<IconProps> = ({ size = 18, className }) => <RiFolderAddLine size={size} className={className} />;
export const EditIcon: React.FC<IconProps> = ({ size = 14, className }) => <RiPencilLine size={size} className={className} />;

// Studio / Manual Control Icons
export const StudioIcon: React.FC<IconProps> = ({ size = 20, className }) => <_RiLayoutMasonryLine size={size} className={className} />;
export const RiLayoutMasonryLine: React.FC<IconProps> = ({ size = 20, className }) => <_RiLayoutMasonryLine size={size} className={className} />;
export const DashboardIcon: React.FC<IconProps> = ({ size = 20, className }) => <RiDashboardLine size={size} className={className} />;
export const DatabaseIcon: React.FC<IconProps> = ({ size = 20, className }) => <RiDatabase2Line size={size} className={className} />;
export const StorageIcon: React.FC<IconProps> = ({ size = 20, className }) => <RiHardDrive2Line size={size} className={className} />;
export const FunctionIcon: React.FC<IconProps> = ({ size = 20, className }) => <RiFlashlightLine size={size} className={className} />;
export const TeamIcon: React.FC<IconProps> = ({ size = 20, className }) => <RiGroupLine size={size} className={className} />;
export const MigrationIcon: React.FC<IconProps> = ({ size = 20, className }) => <_RiShareForwardLine size={size} className={className} />;
export const RiShareForwardLine: React.FC<IconProps> = ({ size = 20, className }) => <_RiShareForwardLine size={size} className={className} />;
export const RiRocketLine: React.FC<IconProps> = ({ size = 20, className }) => <_RiRocketLine size={size} className={className} />;

export const CommandLineIcon: React.FC<IconProps> = ({ size = 20, className }) => <RiCommandLine size={size} className={className} />;

export const BackupIcon: React.FC<IconProps> = ({ size = 20, className }) => <RiHistoryLine size={size} className={className} />;
export const CloudIcon: React.FC<IconProps> = ({ size = 20, className }) => <RiCloudLine size={size} className={className} />;
export const DownloadCloudIcon: React.FC<IconProps> = ({ size = 20, className }) => <RiDownloadCloud2Line size={size} className={className} />;
export const UploadCloudIcon: React.FC<IconProps> = ({ size = 20, className }) => <RiUploadCloud2Line size={size} className={className} />;

// Fix: Adding missing icon exports for McpTab and FunctionsTab
export const McpIcon: React.FC<IconProps> = ({ size = 20, className }) => <RiPlugLine size={size} className={className} />;
export const RiGlobalLine: React.FC<IconProps> = ({ size = 20, className }) => <_RiGlobalLine size={size} className={className} />;
