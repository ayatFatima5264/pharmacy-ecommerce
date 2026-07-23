import * as XLSX from 'xlsx'
import { can } from '@/features/auth/staff/guards'
import { TEMPLATE_COLUMNS, type ImportType } from '@/features/imports/engine'

export const dynamic = 'force-dynamic'

/**
 * Sample-file download for the import flow. Generates a one-row workbook from
 * the SAME TEMPLATE_COLUMNS the staging engine validates against — the sample
 * can never drift from what the importer accepts.
 */

const SAMPLE_ROWS: Record<ImportType, Record<string, string | number>> = {
  products: {
    sku: 'PANA-500-10',
    product_name: 'Panadol 500mg',
    brand: 'GSK',
    categories: 'pain-relief',
    price: 120,
    sale_price: 110,
    stock: 50,
    rx_required: 'no',
    description: 'Paracetamol 500mg tablets for fever and mild pain.',
    pack_size: '10 tablets',
  },
  lab_tests: {
    test_code: 'CBC',
    test_name: 'Complete Blood Count',
    price: 800,
    sample_type: 'Blood',
    fasting_hours: 0,
    report_hours: 24,
    home_collection: 'yes',
  },
}

export async function GET(request: Request) {
  if (!(await can('products.manage'))) {
    return new Response('Forbidden', { status: 403 })
  }

  const url = new URL(request.url)
  const typeParam = url.searchParams.get('type')
  const type: ImportType = typeParam === 'lab_tests' ? 'lab_tests' : 'products'

  // Header row in template order, one realistic example row underneath.
  const sheet = XLSX.utils.json_to_sheet([SAMPLE_ROWS[type]], {
    header: [...TEMPLATE_COLUMNS[type]],
  })
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, type === 'products' ? 'Products' : 'LabTests')
  const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${type === 'products' ? 'products' : 'lab-tests'}-import-template.xlsx"`,
    },
  })
}
