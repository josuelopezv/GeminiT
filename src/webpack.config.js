const path = require('path');

module.exports = {
    mode: 'development',
    entry: './src/renderer.ts',
    target: 'electron-renderer',
    output: {
        filename: 'renderer.js',
        path: path.resolve(__dirname, 'dist')
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js']
    },
    devtool: 'source-map'
};