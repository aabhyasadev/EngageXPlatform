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
      
      try {
        const response = await apiRequest("POST", "/api/contacts/import_csv/", formData);
        return response;
      } catch (error: any) {
        // Handle both JSON and non-JSON error responses
        const errorMessage = error.message || error.error || error.detail || "Import failed";
        throw new Error(errorMessage);
      }
    },
    onSuccess: (result) => {
      setImportResult(result);
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === "/api/contacts/";
        }
      });
      toast({
        title: "Import Started",
        description: result.message || "Your contact import has been started and will be processed in the background.",
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
        description: "Please select a CSV or Excel file to import",
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
          <DialogTitle>Import Contacts</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Instructions */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-2">File Requirements</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• CSV or Excel file (.csv, .xlsx, .xls format)</li>
                <li>• Required column: email or Email</li>
                <li>• Optional columns: first_name, last_name, phone, language</li>
                <li>• Alternative column names: firstName, lastName, First Name, Last Name, Phone</li>
                <li>• Import runs in background - contacts appear once processing is complete</li>
              </ul>
            </CardContent>
          </Card>

          {/* File Upload */}
          <div>
            <Label htmlFor="file">Select CSV or Excel File</Label>
            <Input
              id="file"
              type="file"
              accept=".csv,.xlsx,.xls"
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
                <h3 className="font-semibold mb-2">Import Status</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-green-600 font-medium" data-testid="text-import-status">
                      Import started successfully
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    Your contacts are being processed in the background. 
                    You can close this dialog and continue working. The contacts 
                    will appear in your list once processing is complete.
                  </p>
                  {importResult.task_id && (
                    <p className="text-xs text-muted-foreground">
                      Task ID: {importResult.task_id}
                    </p>
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
