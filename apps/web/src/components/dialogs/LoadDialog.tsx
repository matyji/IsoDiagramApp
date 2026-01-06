import React from 'react';
import { SavedDiagram } from '../../types';

interface LoadDialogProps {
    diagrams: SavedDiagram[];
    onLoad: (diagram: SavedDiagram) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
}

const LoadDialog: React.FC<LoadDialogProps> = ({
    diagrams,
    onLoad,
    onDelete,
    onClose
}) => {
    return (
        <div className="dialog-overlay">
            <div className="dialog">
                <h2>Charger le diagramme (Session actuelle uniquement)</h2>
                <div
                    style={{
                        backgroundColor: '#fff3cd',
                        border: '1px solid #ffeeba',
                        padding: '15px',
                        borderRadius: '4px',
                        marginBottom: '20px'
                    }}
                >
                    <strong>⚠️ Remarque:</strong>{' '}
                    Ces enregistrements sont temporaires. Exportez vos diagrammes pour les conserver de manière permanente.
                </div>
                <div className="diagram-list">
                    {diagrams.length === 0 ? (
                        <p>Aucun diagramme enregistré trouvé dans cette session</p>
                    ) : (
                        diagrams.map((diagram) => (
                            <div key={diagram.id} className="diagram-item">
                                <div>
                                    <strong>{diagram.name}</strong>
                                    <br />
                                    <small>
                                        Mis à jour: {' '}
                                        {new Date(diagram.updatedAt).toLocaleString()}
                                    </small>
                                </div>
                                <div className="diagram-actions">
                                    <button onClick={() => onLoad(diagram)}>Charger</button>
                                    <button onClick={() => onDelete(diagram.id)}>Supprimer</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                <div className="dialog-buttons">
                    <button onClick={onClose}>Fermer</button>
                </div>
            </div>
        </div>
    );
};

export default LoadDialog;
