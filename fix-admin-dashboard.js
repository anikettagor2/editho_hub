const fs = require('fs');
const path = require('path');

const filePath = path.join('c:', 'project', 'EditoHub', 'src', 'app', 'dashboard', 'components', 'admin-dashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Wallet to lucide-react
if (!content.includes('Wallet') && content.includes('Download,')) {
    content = content.replace('Download,', 'Download,\n  Wallet,');
}

// 2. Add settleEditorPayment and EditorSettlementModal
if (!content.includes('settleEditorPayment') && content.includes('assignManagerToClient,')) {
    content = content.replace('assignManagerToClient,', 'assignManagerToClient,\n  settleEditorPayment,');
}
if (!content.includes('EditorSettlementModal')) {
    content = content.replace('import { initiateEditorPayout } from "@/app/actions/payout-actions";', 
        'import { initiateEditorPayout } from "@/app/actions/payout-actions";\nimport { EditorSettlementModal } from "@/components/qr-payment-modal";');
}

// 3. Add Dropdown Item (Search for Settle Payment and add after)
const dropdownItem = `                                    {project.assignedEditorId && !project.editorPaid && (
                                      <DropdownMenuItem
                                        className="p-2.5 text-xs text-blue-500 hover:bg-blue-500/10 transition-colors cursor-pointer rounded-lg font-bold"
                                        onClick={() => {
                                          setSelectedProject(project);
                                          setIsSettlementModalOpen(true);
                                        }}
                                      >
                                        <Wallet className="mr-2.5 h-3.5 w-3.5" />{" "}
                                        Settle Editor Dues
                                      </DropdownMenuItem>
                                    )}`;

if (!content.includes('Settle Editor Dues')) {
    // Find Settle Payment item and add after it
    const settlePaymentRegex = /\{\(project as any\)\.paymentOption ===\s+"pay_later" &&\s+project\.paymentStatus !== "full_paid" && \(\s+<DropdownMenuItem[\s\S]+?<\/DropdownMenuItem>\s+\)\}/g;
    content = content.replace(settlePaymentRegex, (match) => match + '\n' + dropdownItem);
}

// 4. Add Modal Render at the end
if (!content.includes('isOpen={isSettlementModalOpen}')) {
    const modalInsert = `
      {selectedProject && (
        <EditorSettlementModal
          isOpen={isSettlementModalOpen}
          onClose={() => setIsSettlementModalOpen(false)}
          project={selectedProject}
          onSettled={() => {
            setIsSettlementModalOpen(false);
            toast.success("Editor payment marked as settled!");
          }}
        />
      )}`;
    content = content.replace('      </Modal>\n    </div>', '      </Modal>\n' + modalInsert + '\n    </div>');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Admin Dashboard updated successfully');
