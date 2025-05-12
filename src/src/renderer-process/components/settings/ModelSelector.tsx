import React from 'react';

interface ModelSelectorProps {
    modelName: string;
    availableModels: string[];
    isLoadingModels: boolean;
    onModelChange: (value: string) => void;
    onFetchModels: () => void;
    isApiKeySet: boolean;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
    modelName,
    availableModels,
    isLoadingModels,
    onModelChange,
    onFetchModels,
    isApiKeySet
}) => {
    return (
        <div className="form-control mb-4">
            <label className="label">
                <span className="label-text">Model Name</span>
            </label>
            <div className="join w-full">
                <select
                    className="select select-bordered join-item w-full"
                    value={modelName}
                    onChange={(e) => onModelChange(e.target.value)}
                    disabled={isLoadingModels || (availableModels.length === 0 && !modelName)}
                >
                    {isLoadingModels ? (
                        <option value="" disabled>Loading models...</option>
                    ) : availableModels.length > 0 ? (
                        availableModels.map(model => (
                            <option key={model} value={model}>{model}</option>
                        ))
                    ) : modelName ? (
                        <option key={modelName} value={modelName}>{modelName}</option>
                    ) : (
                        <option value="" disabled>No models available. Fetch or manually enter.</option>
                    )}
                </select>
                <button
                    className={`btn join-item ${isLoadingModels ? 'btn-disabled' : 'btn-neutral'}`}
                    onClick={onFetchModels}
                    disabled={isLoadingModels || !isApiKeySet}
                >
                    {isLoadingModels ? <span className="loading loading-spinner loading-xs"></span> : 'Fetch Models'}
                </button>
            </div>
            <label className="label">
                <span className="label-text-alt">Select a model from the list. Use 'Fetch Models' if the list is empty or needs update.</span>
            </label>
        </div>
    );
};

export default ModelSelector;
