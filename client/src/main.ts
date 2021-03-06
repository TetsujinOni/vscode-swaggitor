'use strict';

import * as path from 'path';

import {
    workspace, Disposable, ExtensionContext, window, TextDocument
} from 'vscode';

import {
    LanguageClient, LanguageClientOptions, SettingMonitor, ServerOptions, TransportKind
} from 'vscode-languageclient';

var YamlJS = require('js-yaml');

/**
 * Checks if a document is actually a swagger document.
 */
function isSwaggerDocument(document: TextDocument) : boolean
{
    try {
        switch (document.languageId) {
            case "json":
                // try parsing it
                var sourceObject = JSON.parse(document.getText());
                // and if parsing succeeds check for the swagger version key
                if(typeof sourceObject !== 'object' || !sourceObject.swagger)
                    return false;
                else
                    return true;
            case "yaml":
            case "yml":
                // try parsing it
                var sourceObject = YamlJS.safeLoad(document.getText());
                // and if parsing succeeds check for the swagger version key
                if(typeof sourceObject !== 'object' || !sourceObject.swagger)
                    return false;
                else
                    return true;
            default:
                return false;
        }
    }
    catch(exc) {
        // if parsing the document fails try looking for the swagger key
        var sourceText = document.getText().toLowerCase();
        
        // if the swagger key cannot be found return false. otherwise assume this is a swagger file
        // and just formatting or syntax errors prevent parsing.
        if(sourceText.indexOf("swagger") != -1)
            return true;
        else
            return false;
    }
}

/**
 * Activates the extension.
 */
export function activate(context: ExtensionContext) {

    // build path to server module
    let serverModule = context.asAbsolutePath(path.join('server', 'main.js'));

    // server debug options
    let debugOptions = {
        execArgv: [
            "--nolazy",
            "--debug=6004"
        ]
    };

    // create server options
    let serverOptions = {
        run: {
            module: serverModule,
            transport: TransportKind.ipc
        },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions
        }
    }

    // create client options
    let clientOptions = {
        documentSelector: ['yaml', 'yml', 'json'],
        synchronize: {
            configurationSection: "swaggitorServerSettings",
            fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
        }
    };
    
    // check if this is a swagger definition at all
    if(isSwaggerDocument(window.activeTextEditor.document) == false)
        return;
    
    let languageClient = new LanguageClient('Swaggitor', serverOptions, clientOptions);

    // add a request to handle displaying a status bar message after validation
    languageClient.onRequest({method: "validated"}, (params: any) : void => {
        if (params != null) {
            window.setStatusBarMessage(params.message, 2000);
        }
        else {
            window.setStatusBarMessage('Swagger definition is valid!', 2000);
        }
    });

    let disposable = languageClient.start();

    context.subscriptions.push(disposable);
}