import { Canvas } from '@nativescript-community/ui-canvas/canvas';
import { Screen, Utils, knownFolders, path } from '@nativescript/core';
import { IMG_COMPRESS, OCRDocument } from '~/models/OCRDocument';
import { recycleImages } from '~/utils/utils.common';
import PDFExportCanvasBase from './PDFExportCanvas.common';

export default class PDFExportCanvas extends PDFExportCanvasBase {
    async export(documents: OCRDocument[], folder = knownFolders.temp().path, filename = Date.now() + '') {
        const start = Date.now();
        const options = this.options;
        if (options.paper_size === 'full') {
            // we enforce 1 item per page
            options.items_per_page = 1;
        }
        this.updatePages(documents);
        this.canvas = new Canvas();
        const pdfDocument = new android.graphics.pdf.PdfDocument();
        const items = this.items;
        for (let index = 0; index < items.length; index++) {
            let pageWidth, pageHeight;
            switch (options.paper_size) {
                case 'a5':
                    pageWidth = 420;
                    pageHeight = 595;
                    break;
                case 'a4':
                    pageWidth = 595;
                    pageHeight = 842;
                    break;
                case 'a3':
                    pageWidth = 842;
                    pageHeight = 1191;
                    break;

                default:
                    break;
            }
            if (options.orientation === 'landscape') {
                const temp = pageWidth;
                pageWidth = pageHeight;
                pageHeight = temp;
            }
            const pageInfo = new android.graphics.pdf.PdfDocument.PageInfo.Builder(pageWidth, pageHeight, index).create();
            const page = pdfDocument.startPage(pageInfo);
            this.canvas.setNative(page.getCanvas());
            const scale = Screen.mainScreen.scale;
            this.canvas.scale(scale, scale);
            await this.loadImagesForPage(index);
            this.drawPages(index, items[index].pages, true);
            pdfDocument.finishPage(page);
        }
        recycleImages(Object.values(this.imagesCache));

        // we need to compress the pdf
        const tempFile = knownFolders.temp().getFile(filename);
        const stream = new java.io.FileOutputStream(tempFile.path);
        pdfDocument.writeTo(stream);
        pdfDocument.close();
        if (folder.startsWith('content://')) {
            const tempFile2 = knownFolders.temp().getFile('compressed.pdf');
            com.akylas.documentscanner.PDFUtils.compressPDF(tempFile.path, tempFile2.path, IMG_COMPRESS);
            const outdocument = androidx.documentfile.provider.DocumentFile.fromTreeUri(Utils.android.getApplicationContext(), android.net.Uri.parse(folder));
            const outfile = outdocument.createFile('application/pdf', filename);
            await tempFile2.copy(outfile.getUri().toString());
            return outdocument.getUri().toString();
        } else {
            const outputPath = path.join(folder, filename);
            try {
                com.akylas.documentscanner.PDFUtils.compressPDF(tempFile.path, outputPath, IMG_COMPRESS);
            } catch (error) {
                console.error('compressPDF error', error, error.stack);
                throw error;
            }
            return outputPath;
        }
        // }
    }
}
