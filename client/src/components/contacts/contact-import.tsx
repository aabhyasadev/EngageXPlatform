import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ContactImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ContactImport({ open, onOpenChange }: ContactImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/contacts/import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Import failed');
      }
      
      return response.json();
    },
    onSuccess: (result) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Import Complete",
        description: `Successfully imported ${result.imported} contacts`,
      });
    },
    onError: (error) => {
      toast({
        title: "Import Error",
        description: error.message || "Failed to import contacts",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setImportResult(null);
    }
  };

  const handleImport = () => {
    if (!file) {
      toast({
        title: "No File Selected",
        description: "Please select an Excel file to import",
        variant: "destructive",
      });
      return;
    }
    
    importMutation.mutate(file);
  };

  const handleClose = () => {
    setFile(null);
    setImportResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Contacts from Excel</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Instructions */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-2">File Requirements</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Excel file (.xlsx format)</li>
                <li>• Required column: email or Email</li>
                <li>• Optional columns: firstName, lastName, phone, language</li>
                <li>• Alternative column names: First Name, Last Name, Phone</li>
              </ul>
            </CardContent>
          </Card>

          {/* File Upload */}
          <div>
            <Label htmlFor="file">Select Excel File</Label>
            <Input
              id="file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="mt-2"
              data-testid="input-import-file"
            />
            {file && (
              <p className="text-sm text-muted-foreground mt-2">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Import Result */}
          {importResult && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">Import Results</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Successfully imported:</span>
                    <span className="font-medium text-green-600" data-testid="text-imported-count">
                      {importResult.imported} contacts
                    </span>
                  </div>
                  {importResult.errors?.length > 0 && (
                    <div>
                      <div className="flex justify-between">
                        <span>Errors:</span>
                        <span className="font-medium text-red-600">
                          {importResult.errors.length} rows
                        </span>
                      </div>
                      <div className="mt-2 max-h-32 overflow-y-auto">
                        {importResult.errors.map((error: any, index: number) => (
                          <div key={index} className="text-xs text-red-600">
                            Row {error.row}: {error.error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3">
            <Button variant="outline" onClick={handleClose}>
              {importResult ? "Close" : "Cancel"}
            </Button>
            {!importResult && (
              <Button 
                onClick={handleImport} 
                disabled={!file || importMutation.isPending}
                data-testid="button-start-import"
              >
                {importMutation.isPending ? "Importing..." : "Import Contacts"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
