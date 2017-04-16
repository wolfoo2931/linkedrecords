counter=1

while true
do
  while npm test &> /dev/null
  do
    counter=$((counter+1))
    if (( $counter % 100 == 0 ))
    then
      echo "successfully run ${counter} times"
    fi
  done

  echo "error after ${counter} runs" | tee -a race_condition_test_results.txt
  counter=0
done

