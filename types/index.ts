export type TaskStatus = 'running' | 'success' | 'error';

export interface FileUploadRequestItem {
    content_type: string;
    file_name: string;
    file_size: number;
}

export interface FileUploadResponseItem {
    content_type: string;
    file_name: string;
    file_id: string;
    requests: {
        method: string;
        url: string;
        headers: Record<string, string>;
    }[];
}

export interface FileUploadResponse {
    status: number;
    data: {
        files: FileUploadResponseItem[];
    };
}

// --- Skin Analysis v2.1 ---

export type SkinConcern =
    | 'redness'
    | 'oiliness'
    | 'age_spot'
    | 'radiance'
    | 'moisture'
    | 'dark_circle_v2'
    | 'eye_bag'
    | 'firmness'
    | 'acne'
    | 'pore'
    | 'wrinkle'
    | 'texture'
    | 'tear_trough'
    | 'skin_type'
    // HD variants
    | 'hd_redness'
    | 'hd_oiliness'
    | 'hd_age_spot'
    | 'hd_radiance'
    | 'hd_moisture'
    | 'hd_dark_circle'
    | 'hd_eye_bag'
    | 'hd_firmness'
    | 'hd_acne'
    | 'hd_pore'
    | 'hd_wrinkle'
    | 'hd_tear_trough'
    | 'hd_skin_type';

export interface SkinAnalysisOutputItem {
    type: string;
    region?: string;
    raw_score: number;
    ui_score: number;
    score?: number;
    mask_urls?: string[];
}

export interface SkinAnalysisTaskResponse {
    status: number;
    data: {
        task_status: TaskStatus;
        error: string | null;
        error_message?: string;
        results?: {
            output: SkinAnalysisOutputItem[];
        };
    };
}

// --- Clothes VTO v4 ---

export type GarmentCategory =
    | 'full_body'
    | 'lower_body'
    | 'upper_body'
    | 'shoes'
    | 'auto'
    | 'outer';

export interface ClothVtoTaskResponse {
    status: number;
    data: {
        task_id: string;
    };
}

export interface ClothVtoStatusResponse {
    url?: string; // present on success, valid for 2 hours
    status?: number; // only present on error responses
    error?: string;
}