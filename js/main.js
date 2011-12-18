//MODELS

var Person = Backbone.Model.extend({
	initialize: function() {
	  this.gifts = new GiftCollection();
	  var self = this;
	  
    this.gifts.bind('add', function(gift, collection){
      gift.view = new GiftView(gift, self).render();
    });
    
    this.gifts.bind('remove', function(gift, collection){
      gift.view.remove();
    });
    
    var update = function(gift, collection){
      gift.view.update();
    };
    this.gifts.bind('change:name', update);
    this.gifts.bind('change:link', update);
    this.gifts.bind('change:cost', update);
	}
});

var Gift = Backbone.Model.extend({
	defaults: {
	  purchased: false,
	  name: "Unnamed",
	  cost: 0,
	  link: null,
	  personCid: null,
	  personName: null
	}
});

var PersonCollection = Backbone.Collection.extend({
	model: Person
});

var GiftCollection = Backbone.Collection.extend({
	model: Gift
});

var Budget = Backbone.Model.extend({
  
  defaults: {
    budget: 0,
    cost: 0,
    total: 0
  }
  
});

var PurchasedGifts = Backbone.Collection.extend({
  model: Gift
});

//VIEWS

var MustacheView = Backbone.View.extend({
  viewId: null,
  model: null,
  addToSelector: null,
  
  render: function() {
    if (!this.template) {
      this.template = $("#" + this.viewId).html();
    }
    
    if (!this.currentView) {
      var newView = this.currentView = $(Mustache.to_html(this.template, {
        cid: this.model.cid,
        attrs: this.model.attributes
      }));
      $(this.addToSelector).append(newView);
    }
    return this;
  },
  
  update: function() {
    this._removeView().render();
  },
  
  remove: function() {
    var self = this;
    this.currentView.fadeOut(200, _.bind(this._removeView, this));
    return this;
  },
  
  _removeView: function(){
    this.currentView.remove();
    this.currentView = null;
    return this;
  }
});

var PersonView = MustacheView.extend({
  viewId: "template-person",
  addToSelector: "#people",
  initialize: function(person) { this.model = person; }
});

var GiftView = MustacheView.extend({
  viewId: "template-gift",
  addToSelector: ".person[cid=personcid] .table-gifts",
  
  initialize: function(gift, person) { 
    this.model = gift; 
    this.addToSelector = this.addToSelector.replace("personcid", person.cid);
  }
});

var PurchaseView = MustacheView.extend({
  viewId: "template-purchase",
  addToSelector: ".purchases",
  initialize: function(gift) { this.model = gift; }
})

$(document).ready(function(){
  
  //PRIMARY DATA
  
  var people = new PersonCollection(),
      purchasedGifts = new PurchasedGifts(),
      budget = new Budget();
  
  //DATA EVENTS
  
  var updateBudget = function(){
    var newCost = purchasedGifts.reduce(function(cost, gift) {
      return cost + parseFloat(gift.get('cost'));
    }, 0);
    budget.set({'cost': newCost});
  };
  
  people.bind('add', function(person, collection){
    person.view = new PersonView(person).render();
    person.gifts.bind('remove', function(gift, collection) {
      if (purchasedGifts.getByCid(gift.cid)) { purchasedGifts.remove(gift); }
    });
    person.gifts.bind('add', function(gift, collection) {
      if (!purchasedGifts.getByCid(gift.cid) && gift.get('purchased')) { purchasedGifts.add(gift); }
    });
    if (people.size() > 0) { $('.no-people').hide(); }
  });
  
  people.bind('remove', function(person, collection){
    var i;
    for (i in person.gifts.models) {
      person.gifts.remove(person.gifts.models[i]);
    }
    person.view.remove();
    if (!people.size()) { $('.no-people').show(); }
  });
  
  purchasedGifts.bind('all', updateBudget);
  
  purchasedGifts.bind('add', function(gift, collection){
    gift.purchasedView = new PurchaseView(gift).render();
  });
  
  purchasedGifts.bind('remove', function(gift, collection){
    gift.purchasedView.remove();
  });
  
  purchasedGifts.bind('change', function(gift, collection){
    gift.purchasedView.update();
  });
  
  budget.bind('change:cost', function(){
    ("" + budget.get('cost')).match(/(\d+\.?\d{0,2})\d*/);
    var cost = RegExp.$1;
    $('.total-cost').html("-$" + cost);
  });
  
  budget.bind('change:total', function(){
    var total = budget.get('total'),
        $total = $('.total');
        
    ("" + Math.abs(budget.get('total'))).match(/(\d+\.?\d{0,2})\d*/);
    var totalString = (total < 0 ? "-$" : "$") + RegExp.$1; 
        
    $total.html(totalString);
    if (total >= 0) { $total.addClass('positive').removeClass('negative'); }
    else { $total.removeClass('positive').addClass('negative'); }
  });
  
  budget.bind('all', function(){
    budget.set({ total: budget.get('budget') - budget.get('cost') });
  });
	
	//CONTROLLER
	
	var controller = new (Backbone.Router.extend({
	  
	  routes: {
	    "Person/:personCid/remove": "removePerson",
	    "Person/:personCid/Gift/:giftCid/remove": "removeGift",
	    "Person/:personCid/Gift/:giftCid/edit": "editGift"
	  },
	  
	  addPerson: function(name) {
	    people.add({ name: name });
	  },
	  
	  removePerson: function(personCid) {
	    var toRemove = people.getByCid(personCid)
	    if (toRemove) { people.remove(toRemove); }
	  },
	  
	  addGift: function(personCid, name, link, cost, giftCid) {
	    var person = people.getByCid(personCid),
	        attrs = {
    	      personCid: personCid,
    	      personName: person ? person.get('name') : null,
    	      name: name,
    	      link: link,
    	      cost: cost
    	    };
    	    
	    if (person) {
	      if (giftCid) {
  	      person.gifts.getByCid(giftCid).set(attrs);
  	      var purchasedGift = purchasedGifts.getByCid(giftCid);
  	      if (purchasedGift) { purchasedGift.set(attrs); }
  	    } else {
  	      person.gifts.add(attrs);
  	    }
	    }
	  },
	  
	  removeGift: function(personCid, giftCid) {
	    var person = people.getByCid(personCid),
          gift = person ? person.gifts.getByCid(giftCid) : null;

	    if (person) {
	      person.gifts.remove(gift);    
  	    purchasedGifts.remove(gift);
	    }
	  },
	  
	  editGift: function(personCid, giftCid) {
	    var person = people.getByCid(personCid),
          gift = person ? person.gifts.getByCid(giftCid) : null,
	        formModal = $("#modal-add-gift"),
	        form = formModal.find("form")[0];
	    
	    if (person) {
	      formModal.modal({
	        backdrop: true,
	        keyboard: true,
	        show: true
	      });
  	    form["person-cid"].value = personCid;
  	    form["gift-name"].value = gift.get('name');
  	    form["link"].value = gift.get('link');
  	    form["cost"].value = gift.get('cost');
  	    form["gift-cid"].value = gift.cid;
	    }
	  }
	  
	}))();
	
	$(".routed").live('click', function(e){
	  controller.navigate($(this).attr('href'), true);
	  e.preventDefault();
	})
  
	
	//MODAL BEHAVIOR 
	
	$("#modal-add-person form").submit(function(){
	  controller.addPerson(this['person-name'].value);
	});
	
	$("#modal-add-gift form").submit(function(){
	  var cost = this['cost'].value;
	  
	  controller.addGift(
	    this["person-cid"].value,
	    this["gift-name"].value || "Unnamed",
	    this["link"].value,
	    (cost.match(PATTERN_MONEY) ? parseFloat(RegExp.$1 + RegExp.$2) : 0) || 0,
	    this["gift-cid"].value
	  );
	});
	
	$(".modal form").submit(function(){
		$(this).attr('locked', "true")
		  .parentsUntil('.modal')
		  .parent()
		  .modal('hide')
		  .find('input')
		  .val("")
		  .trigger('keyup');
		return false;
	});
	
	$(".modal form").keyup(function(e){
	  var $this = $(this);
		if ("true" !== $this.attr('locked') && e.which === 13) { $this.trigger('submit'); }
	});
	
	$(".modal .secondary").click(function(e){
		$(this).parentsUntil('.modal').parent().modal('hide');
		e.preventDefault();
	});
	
	$(".modal .success").click(function(e){
		$(this).parentsUntil('.modal').parent().find('form').trigger('submit');
		e.preventDefault();
	});
	
	$(".modal").bind('shown', function(){
	  $("form", this).attr('locked', "false").find("input").first().focus();
	});
	
	//augmentation to add modal button attributes in the form 'parm-[input name]'
	//as values to inputs within the opened modal
	$("button, a").live('click', function(){
	  var $this = $(this),
	      modalId = $this.attr('data-controls-modal')
	  if (modalId) {
	    $('#' + modalId + " form").find('input').each(function(){
	      if ($this.attr('parm-' + this.name)) {
	        $(this).val($this.attr('parm-' + this.name));
	      }
	    });
	  }
	});
	
	//SELECTING GIFTS
	
	$('.checkbox-purchase-selected').live('click', function(){
	  var $this = $(this),
	      giftCid = $(this).parentsUntil('.gift').parent().attr('cid'),
        personCid = $(this).parentsUntil('.person').parent().attr('cid'),
        gift = people.getByCid(personCid).gifts.getByCid(giftCid);
        
    gift.set({'purchased': this.checked});
	  if (this.checked) {
	    if (!purchasedGifts.getByCid(giftCid)) { purchasedGifts.add(gift); }
	  } else {
	    if (purchasedGifts.getByCid(giftCid)) { purchasedGifts.remove(gift); }
	  }
	});
	
	//OTHER
	
	var PATTERN_MONEY = /^(-)?\$?(\d+(\.\d{0,2}){0,1})$/g;
	
	$('.money').keyup(function(){
	  if (this.value === "") {
	    $(this).parent().parent().removeClass('success').removeClass('error');
	  } else if (this.value.match(PATTERN_MONEY)){
	    $(this).parent().parent().addClass('success').removeClass('error');
	  } else {
	    $(this).parent().parent().addClass('error').removeClass('success');
	  }
	});
	
	$('.budget-amount input').keyup(function(){
	  if (this.value.match(PATTERN_MONEY)){
	   budget.set({budget: parseFloat(RegExp.$1 + RegExp.$2)}); 
    } else {
      budget.set({budget: 0}); 
    }
	});
	
	//LOCAL STORAGE
  
  people.bind('all', function(person, collection){
    $.jStorage.set("people", $.toJSON(people));
  });
  
  people.bind('add', function(person, collection){
    person.gifts.bind('all', function() {
      $.jStorage.set("gifts:" + person.get('name'), $.toJSON(person.gifts));
    });
  });
  
  budget.bind('all', function(){
    $.jStorage.set('budget', $.toJSON(budget));
  });
  
  //RESTORE FROM STORAGE
  
  budget.set($.parseJSON($.jStorage.get("budget")));
  $('.budget-amount .money').val(budget.get('budget') || 0);
  
  people.reset($.parseJSON($.jStorage.get("people")));
	people.each(function(person) { 
	  people.trigger('add', person, people);
	  person.gifts.reset($.parseJSON($.jStorage.get("gifts:" + person.get('name'))));
	  person.gifts.each(function(gift){
	    person.gifts.trigger('add', gift, person.gifts);
	  });
  });

  //Backbone.history.start();
	
});