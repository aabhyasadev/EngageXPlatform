import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface DomainVerificationProps {
  domain: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DomainVerification({ domain, open, onOpenChange }: DomainVerificationProps) {
  const { toast } = useToast();

  const dnsRecords = [
    {
      type: "DKIM",
      name: `selector._domainkey.${domain.domain}`,
      value: domain.dkimRecord || "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...",
      description: "Authenticates your emails and prevents spoofing",
    },
    {
      type: "CNAME",
      name: `mail.${domain.domain}`,
      value: domain.cnameRecord || "mail.engagex.io",
      description: "Points your mail subdomain to our servers",
    },
    {
      type: "DMARC",
      name: `_dmarc.${domain.domain}`,
      value: domain.dmarcRecord || `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain.domain}`,
      description: "Defines how to handle emails that fail authentication",
    },
    {
      type: "TXT",
      name: domain.domain,
      value: domain.txtRecord || "v=spf1 include:engagex.io ~all",
      description: "SPF record authorizes our servers to send on your behalf",
    },
  ];

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard",
        description: `${type} record copied successfully`,
      });
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const getRecordStatus = (type: string) => {
    // In a real implementation, you would check the actual DNS records
    // For now, we'll simulate based on domain status
    if (domain.status === 'verified') {
      return { status: 'verified', color: 'bg-green-100 text-green-800' };
    } else if (domain.status === 'pending') {
      return { status: 'pending', color: 'bg-yellow-100 text-yellow-800' };
    } else {
      return { status: 'not found', color: 'bg-red-100 text-red-800' };
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>DNS Records for {domain.domain}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Domain Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Domain Status</span>
                <Badge className={
                  domain.status === 'verified' ? 'bg-green-100 text-green-800' :
                  domain.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }>
                  {domain.status}
                </Badge>
              </CardTitle>
              <CardDescription>
                {domain.status === 'verified' && "Your domain is verified and ready to send emails"}
                {domain.status === 'pending' && "Waiting for DNS records to be configured"}
                {domain.status === 'failed' && "DNS verification failed. Please check your records"}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Setup Instructions</CardTitle>
              <CardDescription>
                Add these DNS records to your domain's DNS settings. Changes may take up to 24 hours to propagate.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Log in to your domain registrar or DNS hosting provider</li>
                <li>Navigate to the DNS management section</li>
                <li>Add each of the DNS records shown below</li>
                <li>Wait for DNS propagation (can take up to 24 hours)</li>
                <li>Click the "Verify Domain" button to check your setup</li>
              </ol>
            </CardContent>
          </Card>

          {/* DNS Records */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">DNS Records to Add</h3>
            
            {dnsRecords.map((record, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline">{record.type}</Badge>
                      <Badge className={getRecordStatus(record.type).color}>
                        {getRecordStatus(record.type).status}
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(record.value, record.type)}
                      data-testid={`button-copy-${record.type.toLowerCase()}`}
                    >
                      <i className="fas fa-copy mr-2"></i>
                      Copy
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <label className="text-sm font-medium text-foreground">Name/Host:</label>
                      <div className="font-mono text-sm bg-muted p-2 rounded mt-1" data-testid={`text-${record.type.toLowerCase()}-name`}>
                        {record.name}
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-foreground">Value:</label>
                      <div className="font-mono text-sm bg-muted p-2 rounded mt-1 break-all" data-testid={`text-${record.type.toLowerCase()}-value`}>
                        {record.value}
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground">{record.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Verification Help */}
          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
              <CardDescription>
                Common DNS providers and their documentation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <i className="fas fa-external-link-alt text-blue-600"></i>
                  </div>
                  <h4 className="font-medium">Cloudflare</h4>
                  <p className="text-xs text-muted-foreground">Managing DNS records in Cloudflare</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <i className="fas fa-external-link-alt text-green-600"></i>
                  </div>
                  <h4 className="font-medium">GoDaddy</h4>
                  <p className="text-xs text-muted-foreground">Adding DNS records in GoDaddy</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <i className="fas fa-external-link-alt text-purple-600"></i>
                  </div>
                  <h4 className="font-medium">Namecheap</h4>
                  <p className="text-xs text-muted-foreground">DNS management in Namecheap</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button data-testid="button-verify-dns">
              <i className="fas fa-sync mr-2"></i>
              Verify Domain
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
