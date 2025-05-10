const path = require('path');

module.exports = {
    mode: 'development',
    entry: './src/renderer.tsx', // Changed to .tsx
    target: 'electron-renderer',
    output: {
        filename: 'renderer.js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: './dist/', // Corrected publicPath for Electron file:// protocol
        assetModuleFilename: 'assets/[hash][ext][query]' // Define output for asset modules
    },
    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/, // Updated to include .tsx
                use: 'ts-loader',
                exclude: /node_modules/
            },
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    'css-loader',
                    {
                        loader: 'postcss-loader',
                        options: {
                            postcssOptions: {
                                ident: 'postcss',
                                plugins: [
                                    require('tailwindcss'),
                                    require('autoprefixer'),
                                ],
                            },
                        },
                    },
                ]
            },
            // New rule for font files
            {
                test: /\.(woff|woff2|eot|ttf|otf|svg)$/i,
                type: 'asset/resource',
            },
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.jsx'] // Added .tsx and .jsx
    },
    devtool: 'source-map'
};