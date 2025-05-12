// src/renderer-process/components/SettingsPanelComponent.tsx
import React, { useRef, useEffect } from 'react';
import { useSettingsLogic } from '../hooks/settings/useSettingsLogic';
import ApiKeyInput from './settings/ApiKeyInput';
import ModelSelector from './settings/ModelSelector';
import InitialInstructionInput from './settings/InitialInstructionInput';

interface SettingsPanelProps {
    isVisible: boolean;
    onClose: () => void;
    initialApiKey: string;
    initialModelName: string;
    initialModelInstruction: string;
    onApiKeyChange: (key: string) => void;
    onModelNameChange: (name: string) => void;
    onInitialModelInstructionChange: (instruction: string) => void;
}

const SettingsPanelComponent: React.FC<SettingsPanelProps> = ({
    isVisible,
    onClose,
    initialApiKey,
    initialModelName,
    initialModelInstruction,
    onApiKeyChange,
    onModelNameChange,
    onInitialModelInstructionChange
}) => {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const {
        apiKey,
        modelName,
        modelInstruction,
        availableModels,
        isLoadingModels,
        error,
        setApiKey,
        setModelName,
        setModelInstruction,
        handleFetchModels,
        handleSave
    } = useSettingsLogic({
        initialApiKey,
        initialModelName,
        initialModelInstruction,
        onApiKeyChange,
        onModelNameChange,
        onInitialModelInstructionChange,
        onClose
    });

    useEffect(() => {
        const dialogNode = dialogRef.current;
        if (dialogNode) {
            if (isVisible) {
                dialogNode.showModal();
            } else {
                dialogNode.close();
            }
        }
    }, [isVisible]);

    const handleDialogClose = () => {
        onClose();
    };

    return (
        <dialog ref={dialogRef} className="modal" onClose={handleDialogClose} onCancel={handleDialogClose}>
            <div className="modal-box w-11/12 max-w-2xl text-base-content">
                <form method="dialog">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold">Settings</h3>
                        <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={onClose} title="Close Settings">
                            <i className="ri-close-line text-xl"></i>
                        </button>
                    </div>
                </form>

                <ApiKeyInput
                    apiKey={apiKey}
                    onChange={setApiKey}
                />

                <ModelSelector
                    modelName={modelName}
                    availableModels={availableModels}
                    isLoadingModels={isLoadingModels}
                    onModelChange={setModelName}
                    onFetchModels={handleFetchModels}
                    isApiKeySet={!!apiKey}
                />

                <InitialInstructionInput
                    modelInstruction={modelInstruction}
                    onChange={setModelInstruction}
                />

                {error && <p className="text-error text-sm mb-4">{error}</p>}

                {/* Modal Actions */}
                <div className="modal-action">
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave}>Save Settings</button>
                </div>
            </div>
        </dialog>
    );
};

export default SettingsPanelComponent;
