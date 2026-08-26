/* eslint-disable @typescript-eslint/no-unused-vars */
function prepareSelect() {
	var x, i, j, l, ll, selElmnt, a, b, c;
	/*look for any elements with the class "custom-select":*/
	x = document.getElementsByClassName('custom-select');
	l = x.length;
	for (i = 0; i < l; i++) {
		selElmnt = x[i].getElementsByTagName('select')[0];
		ll = selElmnt.length;
		/*for each element, create a new DIV that will act as the selected item:*/
		a = document.createElement('DIV');
		a.setAttribute('class', 'select-selected line-ellipsis');
		a.innerHTML = Encoder.encodeForHTML(selElmnt.options[selElmnt.selectedIndex].innerHTML);
		x[i].appendChild(a);
		/*for each element, create a new DIV that will contain the option list:*/
		b = document.createElement('DIV');
		b.setAttribute('class', 'select-items select-hide');
		for (j = 0; j < ll; j++) {
			/*for each option in the original select element,
      create a new DIV that will act as an option item:*/
			c = document.createElement('DIV');
			if (j == 0) {
				c.setAttribute('class', 'same-as-selected');
			}
			const enProjName = Encoder.encodeForHTML(selElmnt.options[j].innerHTML);
			const enProjectId = Encoder.encodeForHTML(selElmnt.options[j].getAttribute('value'));
			c.innerHTML = `
			<div style="padding: 14px 16px; display: block;">
              <div class="dF" style="height: auto">
                  <p class="selected-text line-ellipsis">${enProjName}</p><span class="active">(Active)</span>
              </div>
              <p class="select-pid line-ellipsis" value="${enProjectId}">PID: ${enProjectId}</p>
			</div>`;
			c.addEventListener('click', (ele) => {
				const pid = ele.currentTarget.querySelector('.select-pid')?.getAttribute('value');
				pid && projectSwitch(pid);
			});
			b.appendChild(c);
		}
		x[i].appendChild(b);
		a.addEventListener('click', selectBoxOnClick);
	}
}

// function optionItemOnClick() {
//   /*when an item is clicked, update the original select box,
//   and the selected item:*/
//   var y, i, k, s, h, sl, yl;
//   s = this.parentNode.parentNode.getElementsByTagName("select")[0];
//   sl = s.length;
//   h = this.parentNode.previousSibling;
//   for (i = 0; i < sl; i++) {
//     if (s.options[i].innerHTML == this.querySelector(".selected-text").innerText) {
//       s.selectedIndex = i;
//       h.innerHTML = this.querySelector(".selected-text").innerText;
//       y = this.parentNode.getElementsByClassName("same-as-selected");
//       yl = y.length;
//       for (k = 0; k < yl; k++) {
//         y[k].removeAttribute("class");
//       }
//       this.setAttribute("class", "same-as-selected");
//       break;
//     }
//   }
//   h.click();
// }

function selectBoxOnClick(e) {
	/*when the select box is clicked, close any other select boxes,
  and open/close the current select box:*/
	e.stopPropagation();
	closeAllSelect(this);
	this.nextSibling.classList.toggle('select-hide');
	this.classList.toggle('select-arrow-active');
	// displayFreezeLayer();
}

function closeAllSelect(elmnt) {
	/*a function that will close all select boxes in the document,
  except the current select box:*/
	var x,
		y,
		i,
		xl,
		yl,
		arrNo = [];
	x = document.getElementsByClassName('select-items');
	y = document.getElementsByClassName('select-selected');
	xl = x.length;
	yl = y.length;
	for (i = 0; i < yl; i++) {
		if (elmnt == y[i]) {
			arrNo.push(i);
		} else {
			y[i].classList.remove('select-arrow-active');
		}
	}
	for (i = 0; i < xl; i++) {
		if (arrNo.indexOf(i)) {
			x[i].classList.add('select-hide');
		}
	}
	// displayFreezeLayer(false);
}
/*if the user clicks anywhere outside the select box,
then close all select boxes:*/
document.addEventListener('click', closeAllSelect);
