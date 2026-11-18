import type { SampleDocumentPreset } from '../types/ocr';

export const SAMPLE_DOCUMENTS: SampleDocumentPreset[] = [
  {
    id: 'handwritten-intake',
    title: 'Handwritten Clinic Intake Note',
    category: 'Handwritten OCR',
    formatLabel: 'JPEG · Handwriting',
    description: 'Blue ballpoint cursive & print medical intake note with vitals, Rx dosage, and physician signature.',
    imageUrl: '/src/assets/images/sample_handwritten_note_1794994417823.jpg',
    fileName: 'clinic_intake_handwritten.jpg',
    defaultRules: [
      'Verify a patient name and date of birth are clearly legible',
      'Verify a licensed physician signature and date are present',
      'Confirm medication dosage and frequency are specified for prescribed items',
    ],
    defaultCustomFields: ['Patient Name', 'DOB', 'Blood Pressure', 'Prescribed Medication', 'Physician Signature'],
  },
  {
    id: 'commercial-invoice',
    title: 'Northstar Logistics Invoice',
    category: 'Financial & Table OCR',
    formatLabel: 'JPEG · Print + Stamp',
    description: 'Itemized commercial invoice with 3 line items, 8% sales tax calculation, approval stamp, and ink signature.',
    imageUrl: '/src/assets/images/sample_commercial_invoice_1794994417877.jpg',
    fileName: 'northstar_invoice_0842.jpg',
    defaultRules: [
      'Verify line item quantities multiplied by unit prices equal each row amount',
      'Verify subtotal plus sales tax and shipping equals the final total',
      'Verify an approval stamp and handwritten authorization signature are present',
    ],
    defaultCustomFields: ['Invoice Number', 'Vendor Name', 'Subtotal', 'Sales Tax', 'Total Amount', 'Approved By'],
  },
  {
    id: 'equipment-inspection',
    title: 'Equipment Inspection Form',
    category: 'Hybrid Form & Checkboxes',
    formatLabel: 'JPEG · Form + Ink',
    description: 'Printed checklist form containing handwritten entries, 12 inspection checkboxes, inspector notes, and dual signatures.',
    imageUrl: '/src/assets/images/sample_signed_form_1794994419210.jpg',
    fileName: 'equipment_inspection_sn9042k.jpg',
    defaultRules: [
      'Verify all 12 checklist items have a selected PASS or FAIL checkbox',
      'Verify both Inspector Signature and Verified By signatures are present',
      'Confirm the overall VERIFICATION RESULTS selection matches the checklist outcomes',
    ],
    defaultCustomFields: ['Equipment ID', 'Model', 'Inspector Name', 'Date of Inspection', 'Verification Result'],
  },
];
