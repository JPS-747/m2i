import { useState } from 'react';
import FileSummaryTable from '../components/FileSummaryTable';
import ColumnMapperModal from '../components/ColumnMapperModal';
import ImportProgressList from '../components/ImportProgressList';
import { PeriodApi } from '../api/periodApi';

export default function SystemFilesPage({ files, canImport, openPeriod, onImport, onDelete, importing, deletingRows }) {
  const [showMapper, setShowMapper] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [availableColumns, setAvailableColumns] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [columnTransformations, setColumnTransformations] = useState({});
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [importingFiles, setImportingFiles] = useState([]);

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoadingPreview(true);
    try {
      const preview = await PeriodApi.previewFile(file);
      setSelectedFile(file);
      setAvailableColumns(preview.columns || []);
      setPreviewRows(preview.preview_rows || []);
      
      // Keep only the mappings where the mapped column exists in the new file
      setColumnMapping((prevMapping) => {
        const newAvailableColumns = preview.columns || [];
        const updatedMapping = {};
        
        // Check each field in the previous mapping
        Object.entries(prevMapping).forEach(([field, mappedColumn]) => {
          // If the mapped column exists in the new file, keep it
          if (mappedColumn && newAvailableColumns.includes(mappedColumn)) {
            updatedMapping[field] = mappedColumn;
          }
        });
        
        return updatedMapping;
      });
      
      setShowMapper(true);
    } catch (error) {
      alert(`Error reading file: ${error.message}`);
    } finally {
      setIsLoadingPreview(false);
      event.target.value = '';
    }
  };

  const handleMappingChange = (field, value) => {
    setColumnMapping((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleTransformationChange = (field, transformation) => {
    setColumnTransformations((prev) => ({
      ...prev,
      [field]: transformation || null,
    }));
  };

  const handleConfirmImport = async () => {
    if (!selectedFile) return;

    const importId = `${selectedFile.name}-${Date.now()}`;
    const fileToImport = selectedFile; // Save reference before clearing state
    const mappingToUse = columnMapping; // Save reference before clearing state
    const transformationsToUse = columnTransformations; // Save reference before clearing state
    
    // Add to importing list and close modal immediately
    setImportingFiles((prev) => [
      ...prev,
      {
        id: importId,
        fileName: fileToImport.name,
        currentRows: 0,
        totalRows: 0,
        percentage: 0,
        status: null,
        errorMessage: null,
      },
    ]);
    
    setShowMapper(false);
    setSelectedFile(null);
    // Keep columnMapping and columnTransformations for next import

    try {
      await onImport(fileToImport, mappingToUse, transformationsToUse, (current, total) => {
        // Update progress in the list
        setImportingFiles((prev) =>
          prev.map((task) =>
            task.id === importId
              ? {
                  ...task,
                  currentRows: current,
                  totalRows: total,
                  percentage: total > 0 ? Math.round((current / total) * 100) : 0,
                }
              : task
          )
        );
      });

      // Mark as completed
      setImportingFiles((prev) =>
        prev.map((task) =>
          task.id === importId ? { ...task, status: 'completed', percentage: 100 } : task
        )
      );

      // Auto-remove after 3 seconds
      setTimeout(() => {
        setImportingFiles((prev) => prev.filter((task) => task.id !== importId));
      }, 3000);
    } catch (error) {
      // Mark as error
      setImportingFiles((prev) =>
        prev.map((task) =>
          task.id === importId
            ? { ...task, status: 'error', errorMessage: error.message }
            : task
        )
      );
    }
  };

  return (
    <>
      <ImportProgressList importingFiles={importingFiles} />

      <ColumnMapperModal
        isOpen={showMapper}
        fileName={selectedFile?.name}
        previewRows={previewRows}
        availableColumns={availableColumns}
        columnMapping={columnMapping}
        columnTransformations={columnTransformations}
        onMappingChange={handleMappingChange}
        onTransformationChange={handleTransformationChange}
        onConfirm={handleConfirmImport}
        onCancel={() => {
          setShowMapper(false);
          setSelectedFile(null);
          // Keep columnMapping and columnTransformations for next import
        }}
        isLoading={false}
      />

      <FileSummaryTable
        title="System Files Summary"
        files={files}
        sourceLabel="System"
        onDeleteFile={onDelete}
        deletingRows={deletingRows}
        canDelete={canImport}
        openPeriod={openPeriod}
        canImport={canImport}
        isLoadingPreview={isLoadingPreview}
        onFileSelect={handleFileSelect}
      />
    </>
  );
}
