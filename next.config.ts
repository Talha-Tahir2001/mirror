import type { NextConfig } from "next"

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: `${process.env.IMAGE_HOSTNAME}`
            }
        ]
    }
}

export default nextConfig
