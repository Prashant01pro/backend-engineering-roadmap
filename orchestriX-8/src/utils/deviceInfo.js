// Extracts and formats human-readable device metadata from request headers.

export const parseDeviceInfo=(req)=>{
    const userAgent=req.headers['user-agent'] || 'Unknown Device'

    // // Express req.ip (handles proxies if app.set('trust proxy', true) is enabled)
    const ip=req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown IP'

    // Detects OS
    let os = 'Unknown OS'
    if (/windows/i.test(userAgent)) os = 'Windows'
    else if (/macintosh|mac os x/i.test(userAgent)) os = 'macOS'
    else if (/android/i.test(userAgent)) os = 'Android'
    else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS'
    else if (/linux/i.test(userAgent)) os = 'Linux'

    // Detect Browser
    let browser = 'Unknown Browser'
    if (/edg/i.test(userAgent)) browser = 'Edge'
    else if (/chrome|crios/i.test(userAgent)) browser = 'Chrome'
    else if (/firefox|fxios/i.test(userAgent)) browser = 'Firefox'
    else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'Safari'

    return {
        browser,
        os,
        ip

    }
}