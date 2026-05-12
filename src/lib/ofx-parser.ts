
export interface OFXTransaction {
  type: 'CREDIT' | 'DEBIT';
  date: string; // YYYY-MM-DD
  amount: number;
  fitId: string;
  memo: string;
}

export function parseOFX(ofxContent: string): OFXTransaction[] {
  const transactions: OFXTransaction[] = [];
  
  // Encontrar blocos de transação <STMTTRN>...</STMTTRN>
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  let match;

  while ((match = stmtTrnRegex.exec(ofxContent)) !== null) {
    const block = match[1];

    const type = getTagValue(block, 'TRNTYPE');
    const dtPosted = getTagValue(block, 'DTPOSTED');
    const trnAmt = getTagValue(block, 'TRNAMT');
    const fitId = getTagValue(block, 'FITID');
    const name = getTagValue(block, 'NAME') || getTagValue(block, 'MEMO');

    if (dtPosted && trnAmt) {
      // Formatar data YYYYMMDD... -> YYYY-MM-DD
      const year = dtPosted.substring(0, 4);
      const month = dtPosted.substring(4, 6);
      const day = dtPosted.substring(6, 8);
      
      transactions.push({
        type: type === 'CREDIT' ? 'CREDIT' : 'DEBIT',
        date: `${year}-${month}-${day}`,
        amount: parseFloat(trnAmt),
        fitId: fitId || `gen_${Date.now()}_${transactions.length}`,
        memo: (name || 'Sem descrição').trim()
      });
    }
  }

  return transactions;
}

function getTagValue(block: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i');
  const match = block.match(regex);
  return match ? match[1].trim() : '';
}
