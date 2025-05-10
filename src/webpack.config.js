const path = require('path');

module.exports = {
    mode: 'development',
    entry: './src/renderer.tsx', // Changed to .tsx
    target: 'electron-renderer',
    output: {
        filename: 'renderer.js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: './' // Important for Electron to find assets correctly
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
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.jsx'] // Added .tsx and .jsx
    },
    devtool: 'source-map'
};