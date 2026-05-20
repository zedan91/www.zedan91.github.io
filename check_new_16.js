
function confirmDeleteProgram(id){
 const ok=confirm('Delete this LISP permanently?\n\nThis action cannot be undone.');
 if(ok){
   deleteProgram(id);
 }
}
