import { promisify } from 'util';
import { resolveTxt, resolveCname } from 'dns';

const resolveTxtAsync = promisify(resolveTxt);
const resolveCnameAsync = promisify(resolveCname);

interface DnsRecord {
  type: 'TXT' | 'CNAME' | 'DKIM' | 'DMARC';
  name: string;
  expectedValue: string;
  actualValue?: string;
  verified: boolean;
  error?: string;
}

export interface DomainVerificationResult {
  domain: string;
  verified: boolean;
  records: DnsRecord[];
  errors: string[];
}

export class DnsVerificationService {
  async verifyDomain(
    domain: string,
    expectedRecords: {
      txtRecord: string;
      cnameRecord: string;
      dkimRecord: string;
      dmarcRecord: string;
    }
  ): Promise<DomainVerificationResult> {
    const records: DnsRecord[] = [];
    const errors: string[] = [];
    
    try {
      // Verify SPF TXT record
      const spfRecord = await this.verifyTxtRecord(domain, expectedRecords.txtRecord);
      records.push(spfRecord);
      
      // Verify DMARC TXT record
      const dmarcRecord = await this.verifyTxtRecord(`_dmarc.${domain}`, expectedRecords.dmarcRecord);
      records.push(dmarcRecord);
      
      // Verify CNAME record
      const cnameRecord = await this.verifyCnameRecord(`mail.${domain}`, expectedRecords.cnameRecord);
      records.push(cnameRecord);
      
      // Note: DKIM verification would require the actual DKIM selector
      // For now, we'll create a placeholder record
      const dkimRecord: DnsRecord = {
        type: 'DKIM',
        name: `selector._domainkey.${domain}`,
        expectedValue: expectedRecords.dkimRecord,
        verified: false, // Would need proper DKIM verification
        error: 'DKIM verification requires specific selector configuration'
      };
      records.push(dkimRecord);
      
    } catch (error) {
      errors.push(`DNS verification error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Domain is verified if at least SPF and DMARC are verified
    const verified = records.filter(r => r.type !== 'DKIM').every(r => r.verified);
    
    return {
      domain,
      verified,
      records,
      errors
    };
  }
  
  private async verifyTxtRecord(domain: string, expectedValue: string): Promise<DnsRecord> {
    try {
      const txtRecords = await resolveTxtAsync(domain);
      const flatRecords = txtRecords.flat();
      
      // Check if any TXT record contains the expected value (partial match for flexibility)
      const matchingRecord = flatRecords.find(record => 
        record.includes(expectedValue.split(' ')[0]) // Match the first part (e.g., "v=spf1")
      );
      
      return {
        type: domain.startsWith('_dmarc') ? 'DMARC' : 'TXT',
        name: domain,
        expectedValue,
        actualValue: matchingRecord || flatRecords[0] || 'Not found',
        verified: !!matchingRecord
      };
    } catch (error) {
      return {
        type: domain.startsWith('_dmarc') ? 'DMARC' : 'TXT',
        name: domain,
        expectedValue,
        verified: false,
        error: `DNS lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  private async verifyCnameRecord(domain: string, expectedValue: string): Promise<DnsRecord> {
    try {
      const cnameRecords = await resolveCnameAsync(domain);
      const actualValue = cnameRecords[0];
      
      return {
        type: 'CNAME',
        name: domain,
        expectedValue,
        actualValue,
        verified: actualValue === expectedValue
      };
    } catch (error) {
      return {
        type: 'CNAME',
        name: domain,
        expectedValue,
        verified: false,
        error: `DNS lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}