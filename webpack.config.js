const path = require('path');
const WebpackShellPlugin = require('webpack-shell-plugin-next');
const nodeExternals = require('webpack-node-externals');
const NODE_ENV = 'development';

const exampleFrontned = {
    entry: path.join(__dirname, 'staticfiles', 'example.ts'),
    target: 'web',
    mode: NODE_ENV,
    devtool: 'inline-source-map',
    watch: NODE_ENV === 'development',
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
};

const main = {
    entry: './index.ts',
    mode: NODE_ENV,
    target: 'node',
    externals: [ nodeExternals() ],
    watch: NODE_ENV === 'development',
    output: {
        path: path.resolve(__dirname, 'build'),
        filename: 'index.js'
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
            },
        ]
    },
    plugins: [
        new WebpackShellPlugin({
            onBuildEnd: {
                scripts: ['npm run run:dev'],
                blocking: false,
                parallel: true
            }
        })
    ]
};

module.exports = [ main, exampleFrontned ]
