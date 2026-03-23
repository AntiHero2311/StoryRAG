import { api } from './api';

export const exportService = {
    /** Export toàn bộ dự án dưới dạng file (docx, html, md, txt). */
    exportProject: async (projectId: string, format: string = 'docx'): Promise<void> => {
        const res = await api.get(`/export/${projectId}`, {
            params: { format },
            responseType: 'blob',
        });
        
        // Tạo file download
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        const extension = format === 'docx' ? 'docx' : format === 'html' ? 'html' : format === 'md' ? 'md' : 'txt';
        const fileName = `Project_Export.${extension}`;
        
        // Header trích xuất tên file nếu lấy được từ disposition
        const disposition = res.headers['content-disposition'];
        let downloadName = fileName;
        if (disposition && disposition.indexOf('attachment') !== -1) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(disposition);
            if (matches != null && matches[1]) { 
                downloadName = matches[1].replace(/['"]/g, '');
            }
        }
        
        link.setAttribute('download', downloadName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    },

    /** Export 1 chương truyện. */
    exportChapter: async (projectId: string, chapterId: string, format: string = 'docx'): Promise<void> => {
        const res = await api.get(`/export/${projectId}/chapters/${chapterId}`, {
            params: { format },
            responseType: 'blob',
        });
        
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        const extension = format === 'docx' ? 'docx' : format === 'html' ? 'html' : format === 'md' ? 'md' : 'txt';
        const fileName = `Chapter_Export.${extension}`;
        
        // Header trích xuất tên file
        const disposition = res.headers['content-disposition'];
        let downloadName = fileName;
        if (disposition && disposition.indexOf('attachment') !== -1) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(disposition);
            if (matches != null && matches[1]) { 
                downloadName = matches[1].replace(/['"]/g, '');
            }
        }
        
        link.setAttribute('download', downloadName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    }
};
