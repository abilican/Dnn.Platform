if (typeof dcc === 'undefined' || dcc === null) {
    dcc = {};
};

dcc.contentTypesViewModel = function(rootViewModel, config){
    var self = this;
    var resx = config.resx;
    var settings = config.settings;
    var util = config.util;
    var $rootElement = config.$rootElement;
    var ko = config.ko;

    self.rootViewModel = rootViewModel;

    self.dataTypes = ko.observableArray([]);

    self.mode = config.mode;
    self.isSystemUser = settings.isSystemUser;
    self.searchText = ko.observable("");
    self.results = ko.observableArray([]);
    self.totalResults = ko.observable(0);
    self.pageSize = ko.observable(settings.pageSize);
    self.pager_PageDesc = resx.pager_PageDesc;
    self.pager_PagerFormat = resx.contentTypes_PagerFormat;
    self.pager_NoPagerFormat = resx.contentTypes_NoPagerFormat;
    // ReSharper disable once InconsistentNaming
    self.selectedContentType = new dcc.contentTypeViewModel(self, config);

    var findContentTypes =  function() {
        self.pageIndex(0);
        self.getContentTypes();
    };

    var getDataTypes = function () {
        var params = {
            searchTerm: '',
            pageIndex: 0,
            pageSize: 1000
        };

        util.dataTypeService().getEntities(params,
            "GetDataTypes",
            self.dataTypes,
            function () {
                // ReSharper disable once InconsistentNaming
                return new dcc.dataTypeViewModel(self, config);
            }
        );
    };

    self.addContentType = function(){
        self.mode("editType");
        self.selectedContentType.init();
    };

    self.editContentType = function(data) {
        util.asyncParallel([
            function(cb1){
                self.getContentType(data.contentTypeId(), cb1);
            }
        ], function() {
            self.mode("editType");
        });
    };

    self.getContentType = function (contentTypeId, cb) {
        var params = {
            contentTypeId: contentTypeId
        };

        util.contentTypeService().getEntity(params, "GetContentType", self.selectedContentType);

        if(typeof cb === 'function') cb();
    };

    self.getContentTypes = function () {
        var params = {
            searchTerm: self.searchText(),
            pageIndex: self.pageIndex(),
            pageSize: self.pageSize()
        };

        util.contentTypeService().getEntities(params,
            "GetContentTypes",
            self.results,
            function() {
                // ReSharper disable once InconsistentNaming
                return new dcc.contentTypeViewModel(self, config);
            },
            self.totalResults
        );
    };

    self.init = function() {
        dnn.pager().init(self, config);
        self.searchText.subscribe(function () {
            findContentTypes();
        });

        $rootElement.find("#contentTypes-editView").css("display", "none");

        getDataTypes();
    };

    self.refresh = function() {
        self.getContentTypes();
    }
};

dcc.contentTypeViewModel = function(parentViewModel, config){
    var self = this;
    var util = config.util;
    var resx = config.resx;
    var ko = config.ko;

    self.parentViewModel = parentViewModel;
    self.rootViewModel = parentViewModel.rootViewModel;

    self.canEdit = ko.observable(false);
    self.created = ko.observable('');
    self.contentTypeId = ko.observable(-1);
    self.isSystem = ko.observable(false);
    self.selected = ko.observable(false);

    self.localizedNames = ko.observableArray([]);
    self.localizedDescriptions = ko.observableArray([]);

    // ReSharper disable once InconsistentNaming
    self.fields = ko.observable(new dcc.contentFieldsViewModel(self, config));
    self.fields().init();

    self.description = ko.computed({
        read: function () {
            return util.getLocalizedValue(self.rootViewModel.selectedLanguage(), self.localizedDescriptions());
        },
        write: function(value) {
            util.setlocalizedValue(self.rootViewModel.selectedLanguage(), self.localizedDescriptions(), value);
        }
    });

    self.isAddMode = ko.computed(function() {
        return self.contentTypeId() === -1;
    });

    self.name = ko.computed({
        read: function () {
            return util.getLocalizedValue(self.rootViewModel.selectedLanguage(), self.localizedNames());
        },
        write: function(value) {
            util.setlocalizedValue(self.rootViewModel.selectedLanguage(), self.localizedNames(), value);
        }
    });

    var validate = function () {
        return util.hasDefaultValue(self.rootViewModel.defaultLanguage, self.localizedNames()) &&
            util.hasDefaultValue(self.rootViewModel.defaultLanguage, self.localizedDescriptions());
    };

    self.cancel = function(){
        self.rootViewModel.closeEdit();
    };

    self.deleteContentType = function (data) {
        util.confirm(resx.deleteContentTypeConfirmMessage, resx.yes, resx.no, function() {
            var params = {
                contentTypeId: data.contentTypeId(),
                name: data.name(),
                isSystem: data.isSystem()
            };

            util.contentTypeService().post("DeleteContentType", params,
                function(){
                    //Success
                    parentViewModel.refresh();
                },

                function(){
                    //Failure
                }
            );
        });
    };

    self.init = function(){
        self.canEdit(true);
        self.contentTypeId(-1);
        self.isSystem(self.parentViewModel.isSystemUser);

        util.initializeLocalizedValues(self.localizedNames, self.rootViewModel.languages());
        util.initializeLocalizedValues(self.localizedDescriptions, self.rootViewModel.languages());
    };

    self.load = function(data) {
        self.canEdit(data.canEdit);
        self.created(data.created);
        self.contentTypeId(data.contentTypeId);
        self.isSystem(data.isSystem);

        util.loadLocalizedValues(self.localizedNames, data.localizedNames);
        util.loadLocalizedValues(self.localizedDescriptions, data.localizedDescriptions);

        if(data.contentFields != null) {
            self.fields().load(data.contentFields);
        }
    };

    self.saveContentType = function(data) {
        if(!validate()) {
            util.alert(resx.invalidContentTypeMessage, resx.ok);
        }
        else {
            var jsObject = ko.toJS(data);
            var params = {
                contentTypeId: jsObject.contentTypeId,
                localizedDescriptions: jsObject.localizedDescriptions,
                localizedNames: jsObject.localizedNames,
                isSystem: jsObject.isSystem
            };

            util.contentTypeService().post("SaveContentType", params,
                function(data) {
                    if (data.success === true) {
                        //Success
                        if (self.isAddMode()) {
                            util.alert(resx.saveContentTypeMessage.replace("{0}", util.getLocalizedValue(self.rootViewModel.selectedLanguage(), self.localizedNames())), resx.ok, function() {
                                self.contentTypeId(data.data.id);
                                self.fields().clear();
                            });
                        } else {
                            self.cancel();
                        }
                    } else {
                        //Error
                        util.alert(data.message, resx.ok);
                    }
                },
                function() {
                    //Failure
                }
            );
        }
    };

    self.toggleSelected = function() {
        self.selected(!self.selected());
    };
}

dcc.contentFieldsViewModel = function(parentViewModel, config) {
    var self = this;
    var resx = config.resx;
    var settings = config.settings;
    var util = config.util;
    var ko = config.ko;

    self.parentViewModel = parentViewModel;
    self.rootViewModel = parentViewModel.rootViewModel;

    self.mode = config.mode;
    self.contentFieldsHeading = resx.contentFields;
    self.contentFields = ko.observableArray([]);
    self.totalResults = ko.observable(0);
    self.pageSize = ko.observable(999);
    self.pager_PageDesc = resx.pager_PageDesc;
    self.pager_PagerFormat = resx.contentFields_PagerFormat;
    self.pager_NoPagerFormat = resx.contentFields_NoPagerFormat;
    // ReSharper disable once InconsistentNaming
    self.selectedContentField = new dcc.contentFieldViewModel(self, config);

    self.addContentField = function() {
        self.mode("editField");
        self.selectedContentField.init();
    }

    self.editContentField = function(data) {
        util.asyncParallel([
            function(cb1){
                self.getContentField(self.parentViewModel.contentTypeId, data.contentFieldId(), cb1);
            }
        ], function() {
            self.mode("editField");
        });
    };

    self.clear = function() {
        self.contentFields.removeAll();
        self.pageIndex(0);
        self.pageSize(settings.pageSize);
    };

    self.getContentField = function (contentTypeId, contentFieldId, cb) {
        var params = {
            contentTypeId: contentTypeId,
            contentFieldId: contentFieldId
        };
        util.contentTypeService().getEntity(params, "GetContentField", self.selectedContentField);

        if(typeof cb === 'function') cb();
    };

    self.moveContentField = function(arg) {
        var params = {
            contentTypeId: parentViewModel.contentTypeId(),
            sourceIndex: arg.sourceIndex,
            targetIndex: arg.targetIndex
        };

        util.contentTypeService().post("MoveContentField", params,
            function () {
                //Success
                self.refresh();
            },

            function () {
                //Failure
            }
        );

    };

    self.init = function() {
        dnn.pager().init(self, config);
    };

    self.load = function(data) {
        self.contentFields.removeAll();

        for(var i=0; i < data.fields.length; i++){
            var result = data.fields[i];
            // ReSharper disable once InconsistentNaming
            var contentField = new dcc.contentFieldViewModel(self, config);
            contentField.load(result);
            self.contentFields.push(contentField);
        }
        self.totalResults(data.totalResults);
    };

    self.refresh = function() {
        var params = {
            contentTypeId: parentViewModel.contentTypeId,
            pageIndex: self.pageIndex(),
            pageSize: self.pageSize()
        };

        util.contentTypeService().getEntities(params,
            "GetContentFields",
            self.contentFields,
            function() {
                // ReSharper disable once InconsistentNaming
                return new dcc.contentFieldViewModel(self, config);
            },
            self.totalResults
        );
    };
}

dcc.contentFieldViewModel = function(parentViewModel, config) {
    var self = this;
    var resx = config.resx;
    var util = config.util;
    var ko = config.ko;

    self.parentViewModel = parentViewModel;
    self.rootViewModel = parentViewModel.rootViewModel;

    self.dataTypes = parentViewModel.parentViewModel.parentViewModel.dataTypes;

    self.mode = config.mode;
    self.contentTypeId = ko.observable(-1);
    self.contentFieldId = ko.observable(-1);
    self.dataTypeId = ko.observable(-1);
    self.selected = ko.observable(false);

    self.localizedDescriptions = ko.observableArray([]);
    self.localizedLabels = ko.observableArray([]);
    self.localizedNames = ko.observableArray([]);

    self.isAddMode = ko.computed(function() {
        return self.contentFieldId() === -1;
    });

    self.description = ko.computed({
        read: function () {
            return util.getLocalizedValue(self.rootViewModel.selectedLanguage(), self.localizedDescriptions());
        },
        write: function(value) {
            util.setlocalizedValue(self.rootViewModel.selectedLanguage(), self.localizedDescriptions(), value);
        }
    });

    self.heading = ko.computed(function() {
        var heading = resx.contentField;
        if (!self.isAddMode()) {
            heading = heading + " - " + self.name();
        }
        return heading;
    });

    self.label = ko.computed({
        read: function () {
            return util.getLocalizedValue(self.rootViewModel.selectedLanguage(), self.localizedLabels());
        },
        write: function(value) {
            util.setlocalizedValue(self.rootViewModel.selectedLanguage(), self.localizedLabels(), value);
        }
    });

    self.name = ko.computed({
        read: function () {
            return util.getLocalizedValue(self.rootViewModel.selectedLanguage(), self.localizedNames());
        },
        write: function(value) {
            util.setlocalizedValue(self.rootViewModel.selectedLanguage(), self.localizedNames(), value);
        }
    });

    self.dataType = ko.computed(function() {
        var value = "";
        if (self.dataTypes !== undefined) {
            var entity = util.getEntity(self.dataTypes(), function(dataType) {
                return (self.dataTypeId() === dataType.dataTypeId());
            });
            if (entity != null) {
                value = entity.name;
            }
        }
        return value;
    });

    var validate = function () {
        return util.hasDefaultValue(self.rootViewModel.defaultLanguage, self.localizedNames()) &&
            util.hasDefaultValue(self.rootViewModel.defaultLanguage, self.localizedLabels()) &&
            util.hasDefaultValue(self.rootViewModel.defaultLanguage, self.localizedDescriptions());
    };

    self.cancel = function(){
        self.mode("editType");
        parentViewModel.refresh();
    };

    self.deleteContentField = function (data) {
        util.confirm(resx.deleteContentFieldConfirmMessage, resx.yes, resx.no, function() {
            var params = {
                contentFieldId: data.contentFieldId(),
                contentTypeId: data.contentTypeId(),
                name: data.name(),
                label: data.label(),
                description: data.description(),
                dataTypeId: data.dataTypeId()
            };

            util.contentTypeService().post("DeleteContentField", params,
                function(){
                    //Success
                    parentViewModel.refresh();
                },

                function(){
                    //Failure
                }
            );
        });
    };

    self.init = function() {
        self.contentFieldId(-1);
        self.contentTypeId(self.parentViewModel.parentViewModel.contentTypeId());
        self.dataTypeId(-1);

        util.initializeLocalizedValues(self.localizedNames, self.rootViewModel.languages());
        util.initializeLocalizedValues(self.localizedLabels, self.rootViewModel.languages());
        util.initializeLocalizedValues(self.localizedDescriptions, self.rootViewModel.languages());

        getDataTypes();
    };

    self.load = function(data) {
        self.contentFieldId(data.contentFieldId);
        self.contentTypeId(data.contentTypeId);
        self.dataTypeId(data.dataTypeId);

        util.loadLocalizedValues(self.localizedNames, data.localizedNames);
        util.loadLocalizedValues(self.localizedLabels, data.localizedLabels);
        util.loadLocalizedValues(self.localizedDescriptions, data.localizedDescriptions);
    }

    self.saveContentField = function(data) {
        if(!validate()) {
            util.alert(resx.invalidContentFieldMessage, resx.ok);
        }
        else {
            var jsObject = ko.toJS(data);
            var params = {
                contentFieldId: jsObject.contentFieldId,
                contentTypeId: jsObject.contentTypeId,
                localizedDescriptions: jsObject.localizedDescriptions,
                localizedNames: jsObject.localizedNames,
                localizedLabels: jsObject.localizedLabels,
                dataTypeId: jsObject.dataTypeId
            };

            util.contentTypeService().post("SaveContentField", params,
                function(data) {
                    if (data.success === true) {
                        //Success
                        self.cancel();
                    } else {
                        //Error
                        util.alert(data.message, resx.ok);
                    }
                },
                function() {
                    //Failure
                }
            );
        }
    };

    self.toggleSelected = function() {
        self.selected(!self.selected());
    };
}