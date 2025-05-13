const path = require('path');

module.exports = {
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    target: 'electron-renderer', entry: {
        renderer: './src/renderer-process/renderer.tsx'
    }, output: {
        filename: '[name].js',
        chunkFilename: 'chunks/[name].[contenthash].js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: './dist/',
        clean: false // Changed to false to prevent clearing main process files
    },
    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/,
                use: 'ts-loader',
                exclude: /node_modules/
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader', {
                    loader: 'postcss-loader',
                    options: {
                        postcssOptions: {
                            plugins: [
                                require('tailwindcss'),
                                require('autoprefixer'),
                            ],
                        },
                    },
                }]
            },
            {
                test: /\.(woff|woff2|eot|ttf|otf|svg)$/i,
                type: 'asset/resource',
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.jsx'],
        fallback: {
            path: false,
            crypto: false
        }
    },
    devtool: process.env.NODE_ENV === 'production' ? 'source-map' : 'eval-source-map',
    performance: {
        hints: false
    }
};
