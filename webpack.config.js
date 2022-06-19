const path = require('path');

const exampleFrontned = {
    entry: path.join(__dirname, 'staticfiles', 'example.ts'),
    target: 'web',
    mode: 'development',
    devtool: 'inline-source-map',
    output: {
        filename: 'example.packaged.js',
        path: path.join(__dirname, 'staticfiles')
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    externals: {
    },
    optimization: {
        minimize: false
    }
}

module.exports = [ exampleFrontned ]
