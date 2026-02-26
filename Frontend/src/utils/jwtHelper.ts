/**
 * Centralized utility for JWT operations and user info extraction.
 */

export function decodeJwt(token: string): Record<string, any> | null {
    try {
        const payload = token.split('.')[1];
        if (!payload) return null;
        // Standard JWT payload decode with base64url handling
        return JSON.parse(
            atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
        );
    } catch {
        return null;
    }
}

export interface UserInfo {
    fullName: string;
    role: string;
    email: string;
    userId: string;
}

export function getUserInfo(token: string | null): UserInfo {
    const defaultInfo: UserInfo = {
        fullName: 'Người dùng',
        role: 'Author',
        email: '',
        userId: ''
    };

    if (!token) return defaultInfo;

    const payload = decodeJwt(token);
    if (!payload) return defaultInfo;

    // Handle ASP.NET Core default claim names and standard OIDC claims
    return {
        fullName:
            payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ||
            payload['name'] ||
            payload['unique_name'] ||
            'Người dùng',
        role:
            payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
            payload['role'] ||
            'Author',
        email:
            payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
            payload['email'] ||
            '',
        userId:
            payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ||
            payload['sub'] ||
            ''
    };
}

export function getInitials(name: string): string {
    if (!name || name === 'Người dùng') return 'ND';
    const parts = name.trim().split(' ').filter(p => p.length > 0);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
