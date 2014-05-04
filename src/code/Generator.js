var util, regs, _, _path, qs;

util = require('./utils/utils');
regs = require('./utils/regs');
_ = require('underscore');
_path = require('path');
qs = require('quote-stream');

//TODO: 对注释的处理
//TODO: 加入构建信息

function Generator( file ) {
    this.file  = file;
}

function amdGenerator(file) {

    var dependencies, dependenciesStr;

    if(!util.needConverted(file.config.filename)) {
        return file.resource;
    }

    dependencies = util.combineDepends(file.requires);

    if(dependencies.length > 0) {
        dependenciesStr = '["require", "exports", "module", ' + _.map(dependencies, function(dep) {
            return '"' + dep + '"';
        }).join(', ') + '], ';
    } else {
        dependenciesStr = '';
    }

    return [
        'define(' + dependenciesStr + 'function(require, exports, module) {\n',
        file.resource,
        'return module.exports;',
        '}',
        ');'
    ].join('\n');
}

function nodeJsGenerator(file) {

    var defineContext, resourceStr, dependenciesStr, specialExports, depMapping, depLen, paramLen, declarationDeps, literalDeps, requires;

    if(!util.needConverted(file.config.filename)) {
        return file.resource;
    }

    defineContext = file.defineContext;
    resourceStr = '';
    dependenciesStr = '';
    depLen = defineContext.dependencies.length;
    paramLen = defineContext.parameters.length;
    specialExports = defineContext.useExports || defineContext.useModule;
    declarationDeps = [];
    literalDeps = [];
    requires = util.combineDepends( file.requires );

    if(depLen > 0 || paramLen > 0) {
        depMapping = util.getRealRequires(defineContext.dependencies, defineContext.parameters);
        _.each(depMapping, function(v) {
            //不支持使用自定义的require依赖
            if(v[0] && v[1]) {
                if(util.canBeRequired(v[1])) {
                    declarationDeps.push(joinRequires(v[0], v[1]));
                }
            } else if(v[0]) {
                if(_.indexOf(requires, v[0]) === -1) {
                    literalDeps.push(joinRequires(v[0]));
                }
            }
        });
    }

    if(declarationDeps.length > 0) {
        dependenciesStr = 'var ' + declarationDeps.join(',\n') + ';\n';
    }

    if(literalDeps.length > 0) {
        dependenciesStr += literalDeps.join(';\n') + ';\n';
    }

    if(defineContext.factoryType === 'Function')  {
        if(specialExports) {
            resourceStr = defineContext.factoryBody;
        } else {
            resourceStr = ['module.exports = (function(){',
                defineContext.factoryBody,
                '})();'].join('\n');
        }
    } else {
        resourceStr = 'module.exports = ' + defineContext.factoryBody + ';';
    }

    return [
        dependenciesStr,
        resourceStr
    ].join('\n');

}

function joinRequires( path, name ) {

    var body;

    body = path;

    //处理plugins
    if(regs.rTextPlugin.test(path)) {
        body = util.getQuotedFile(path.replace(regs.rTextPlugin, function(s, p) {
            return p;
        }));

        //如果有name返回name = "textBody"形式，如果没有name直接返回require("path")
        if(name) {
            return name + ' = ' + body;
        } else {
            return 'require("' + path + '")';
        }
    }

    if(name) {
        return name + ' = require("' + body + '")';
    } else {
        return 'require("' + body + '")';
    }


}

Generator.prototype.AMD = function() {
    return amdGenerator(this.file);
};

Generator.prototype.nodejs = function() {
    return nodeJsGenerator(this.file);
};

Generator.prototype.generator = function() {
    return this[this.file.config.template]();
};


module.exports = Generator;