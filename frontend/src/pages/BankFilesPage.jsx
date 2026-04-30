import { useState } from 'react';
import FileSummaryTable from '../components/FileSummaryTable';
import BankMovementTypeModal from '../components/BankMovementTypeModal';
import ImportProgressList from '../components/ImportProgressList';
import { PeriodApi } from '../api/periodApi';

// Helper function to apply transformation to a value
const applyTransformation = (value, transformation) => {
  if (!transformation || !value) return value;

  const transformStr = String(value).trim();
  // Split by semicolon for multiple transformations
  const transformations = transformation.split(';').map(t => t.trim());

  let result = transformStr;

  for (const transform of transformations) {
    if (transform === 'convert_negative' || transform === 'abs') {
      const num = parseFloat(result);
      if (!isNaN(num)) {
        result = String(Math.abs(num));
      }
    } else if (transform === 'uppercase') {
      result = result.toUpperCase();
    } else if (transform === 'trim') {
      result = result.trim();
    } else if (transform.startsWith('substring:')) {
      const parts = transform.substring(10).split(',');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : result.length;
      result = result.substring(start, end);
    } else if (transform.startsWith('skip_if:')) {
      const skipValue = transform.substring(8);
      if (result === skipValue) {
        return null; // Signal to skip this row
      }
    } else if (transform.startsWith('left_of:')) {
      const chars = transform.substring(8);
      const index = result.indexOf(chars);
      if (index !== -1) {
        result = result.substring(0, index);
      }
    } else if (transform.startsWith('change_value:')) {
      const newValue = transform.substring(13);
      result = newValue;
    } else if (transform.startsWith('replace_if:')) {
      const replacement = transform.substring(11);
      if (replacement.includes('=')) {
        const [findValue, replaceValue] = replacement.split('=', 1);
        // Replace entire value if findValue is found anywhere in result
        if (result.includes(findValue)) {
          result = replaceValue;
        }
      }
    } else if (transform.startsWith('negate_if:')) {
      // negate_if is only applied on Amount field during import, just mark it for reference
      // The actual negation happens on the backend
    }
  }

  return result;
};

export default function BankFilesPage({ files, canImport, openPeriod, onImport, onDelete, importing, deletingRows }) {
  const [showMapper, setShowMapper] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [availableColumns, setAvailableColumns] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [columnTransformations, setColumnTransformations] = useState({});
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [importingFiles, setImportingFiles] = useState([]);

  const convertTxtToCsv = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          
          // Detect delimiter (tab, pipe, semicolon, or comma)
          const lines = text.split('\n').filter(line => line.trim());
          if (lines.length === 0) {
            reject(new Error('File is empty'));
            return;
          }
          
          let delimiter = ',';
          const firstLine = lines[0];
          
          if (firstLine.includes('\t')) {
            delimiter = '\t';
          } else if (firstLine.includes('|')) {
            delimiter = '|';
          } else if (firstLine.includes(';')) {
            delimiter = ';';
          }
          
          // Parse header and determine expected column count
          let headerFields = firstLine.split(delimiter).map(field => field.trim());
          
          // Filter out auto-generated column names (e.g., ___ AA ___, ___ AB ___, etc.)
          // Keep only columns with actual content or meaningful names
          const validColumnIndices = headerFields
            .map((field, index) => ({ field, index }))
            .filter(({ field }) => {
              // Skip columns that are only underscores and spaces
              const cleanField = field.replace(/[_\s]/g, '');
              return cleanField.length > 0 && field.trim().length > 0;
            })
            .map(({ index }) => index);
          
          // Use only the valid columns
          headerFields = validColumnIndices.map(i => headerFields[i]);
          const expectedColumnCount = headerFields.length;
          
          // Convert to CSV using comma delimiter
          const csvContent = lines
            .map((line, lineIndex) => {
              // Split by detected delimiter
              const fields = line.split(delimiter).map(field => {
                // Trim and escape fields if they contain commas or quotes
                const trimmed = field.trim();
                if (trimmed.includes(',') || trimmed.includes('"')) {
                  return `"${trimmed.replace(/"/g, '""')}"`;
                }
                return trimmed;
              });
              
              // For data rows, keep only the valid column values
              if (lineIndex > 0) {
                return validColumnIndices
                  .map(i => fields[i] || '')
                  .join(',');
              }
              
              // For header row, use the filtered headers
              return headerFields.join(',');
            })
            .join('\n');
          
          // Create a new File object with CSV extension
          const csvFile = new File(
            [csvContent],
            file.name.replace(/\.txt$/i, '.csv'),
            { type: 'text/csv' }
          );
          
          resolve(csvFile);
        } catch (error) {
          reject(new Error(`Failed to convert file: ${error.message}`));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsText(file);
    });
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoadingPreview(true);
    try {
      // Convert .txt to .csv if needed
      let processedFile = file;
      if (file.name.toLowerCase().endsWith('.txt')) {
        processedFile = await convertTxtToCsv(file);
      }

      const preview = await PeriodApi.previewFile(processedFile);
      setSelectedFile(processedFile);
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
    // Keep columnMapping for next import

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

      <BankMovementTypeModal
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
        title="Bank Files Summary"
        files={files}
        sourceLabel="Bank"
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
